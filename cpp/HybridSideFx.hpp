#pragma once

#include "../nitrogen/generated/shared/c++/HybridSideFxSpec.hpp"
#include "../nitrogen/generated/shared/c++/ListenerConfig.hpp"
#include "../nitrogen/generated/shared/c++/ListenerInfo.hpp"
#include "../nitrogen/generated/shared/c++/ListenerResult.hpp"
#include "../nitrogen/generated/shared/c++/SAMConfig.hpp"
#include <NitroModules/Null.hpp>
#include <chrono>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <variant>
#include <vector>
#include <sqlite3.h>
#include <sstream>
#include <iomanip>

// MMKV C++ Core library - shared with react-native-mmkv
#include <MMKV/MMKV.h>

// Platform-specific includes for path detection
#ifdef __APPLE__
#import <Foundation/Foundation.h>
#endif

namespace margelo::nitro::sam {

/**
 * C++ implementation of SideFx HybridObject
 * State Awareness Manager - Reactive listeners for MMKV and SQLite storage
 */
class HybridSideFx : public HybridSideFxSpec {
public:
  HybridSideFx() : HybridObject(TAG), _debugMode(false), _maxListeners(10000) {}

  ~HybridSideFx() {
    // Close all SQLite database connections
    for (auto& pair : _sqliteDatabases) {
      if (pair.second != nullptr) {
        sqlite3_close(pair.second);
      }
    }
    _sqliteDatabases.clear();
  }

  // =========================================================================
  // Listener Management
  // =========================================================================

  ListenerResult addListener(const std::string& id,
                             const ListenerConfig& config) override {
    std::lock_guard<std::mutex> lock(_mutex);

    // Check if ID already exists
    if (_listeners.find(id) != _listeners.end()) {
      return ListenerResult(false, "Listener with ID '" + id + "' already exists");
    }

    // Check max listeners limit
    if (_listeners.size() >= _maxListeners) {
      return ListenerResult(false, "Maximum listener limit reached");
    }

    // Validate config
    if (!config.mmkv.has_value() && !config.sqlite.has_value() &&
        !config.combined.has_value()) {
      return ListenerResult(false, "At least one of mmkv, sqlite, or combined must be specified");
    }

    // Create listener entry
    ListenerEntry entry;
    entry.id = id;
    entry.config = config;
    entry.createdAt = getCurrentTimestamp();
    entry.triggerCount = 0;
    entry.isPaused = false;
    entry.nextAllowedTrigger = std::nullopt;
    entry.hasPendingEvent = false;

    _listeners[id] = entry;

    if (_debugMode) {
      logDebug("Added listener: " + id);
    }

    return ListenerResult(true, std::nullopt);
  }

  ListenerResult removeListener(const std::string& id) override {
    std::lock_guard<std::mutex> lock(_mutex);

    auto it = _listeners.find(id);
    if (it == _listeners.end()) {
      return ListenerResult(false, "Listener '" + id + "' not found");
    }

    _listeners.erase(it);

    if (_debugMode) {
      logDebug("Removed listener: " + id);
    }

    return ListenerResult(true, std::nullopt);
  }

  double removeAllListeners() override {
    std::lock_guard<std::mutex> lock(_mutex);
    double count = static_cast<double>(_listeners.size());
    _listeners.clear();

    if (_debugMode) {
      logDebug("Removed all listeners: " + std::to_string(static_cast<int>(count)));
    }

    return count;
  }

  bool hasListener(const std::string& id) override {
    std::lock_guard<std::mutex> lock(_mutex);
    return _listeners.find(id) != _listeners.end();
  }

  std::vector<std::string> getListenerIds() override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::vector<std::string> ids;
    ids.reserve(_listeners.size());
    for (const auto& pair : _listeners) {
      ids.push_back(pair.first);
    }
    return ids;
  }

  std::vector<ListenerInfo> getListeners() override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::vector<ListenerInfo> infos;
    infos.reserve(_listeners.size());
    for (const auto& pair : _listeners) {
      infos.push_back(createListenerInfo(pair.second));
    }
    return infos;
  }

  std::optional<ListenerInfo> getListener(const std::string& id) override {
    std::lock_guard<std::mutex> lock(_mutex);
    auto it = _listeners.find(id);
    if (it == _listeners.end()) {
      return std::nullopt;
    }
    return createListenerInfo(it->second);
  }

  ListenerResult pauseListener(const std::string& id) override {
    std::lock_guard<std::mutex> lock(_mutex);
    auto it = _listeners.find(id);
    if (it == _listeners.end()) {
      return ListenerResult(false, "Listener '" + id + "' not found");
    }
    it->second.isPaused = true;
    return ListenerResult(true, std::nullopt);
  }

  ListenerResult resumeListener(const std::string& id) override {
    std::lock_guard<std::mutex> lock(_mutex);
    auto it = _listeners.find(id);
    if (it == _listeners.end()) {
      return ListenerResult(false, "Listener '" + id + "' not found");
    }
    it->second.isPaused = false;
    return ListenerResult(true, std::nullopt);
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  void configure(const SAMConfig& config) override {
    std::lock_guard<std::mutex> lock(_mutex);
    if (config.debug.has_value()) {
      _debugMode = config.debug.value();
    }
    if (config.maxListeners.has_value()) {
      _maxListeners = static_cast<size_t>(config.maxListeners.value());
    }
    // cacheSize is stored for future use
  }

  // =========================================================================
  // Storage Initialization
  // =========================================================================

  std::string getDefaultMMKVPath() override {
    return getDefaultMMKVPathInternal();
  }

  void setMMKVRootPath(const std::string& rootPath) override {
    std::lock_guard<std::mutex> lock(_mutex);
    if (_mmkvGlobalInitialized) {
      logDebug("Warning: MMKV already initialized, setMMKVRootPath has no effect");
      return;
    }
    _mmkvRootPath = rootPath;
    if (_debugMode) {
      logDebug("MMKV root path set to: " + rootPath);
    }
  }

  ListenerResult initializeMMKV(const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Check if already initialized in our tracking
    if (_mmkvInstances.find(id) != _mmkvInstances.end()) {
      if (_debugMode) {
        logDebug("MMKV instance already initialized: " + id);
      }
      return ListenerResult(true, std::nullopt);
    }

    // Initialize MMKV globally if not done yet
    // This uses the same default path that react-native-mmkv uses,
    // so storage is shared if both libraries are present
    if (!_mmkvGlobalInitialized) {
      // Auto-detect default path if not explicitly set
      if (_mmkvRootPath.empty()) {
        _mmkvRootPath = getDefaultMMKVPathInternal();
        if (_mmkvRootPath.empty()) {
          return ListenerResult(false,
            "MMKV root path not set and could not auto-detect. "
            "Call setMMKVRootPath() first with your app's files directory + '/mmkv'");
        }
        if (_debugMode) {
          logDebug("Auto-detected MMKV root path: " + _mmkvRootPath);
        }
      }

      // Initialize MMKV with the configured root path
      MMKV::initializeMMKV(_mmkvRootPath);
      _mmkvGlobalInitialized = true;
      if (_debugMode) {
        logDebug("MMKV globally initialized at: " + _mmkvRootPath);
      }
    }

    // Get or create the MMKV instance
    MMKV* mmkv = getMMKVInstance(id);
    if (mmkv == nullptr) {
      return ListenerResult(false, "Failed to create MMKV instance: " + id);
    }

    _mmkvInstances.insert(id);

    if (_debugMode) {
      logDebug("Initialized MMKV instance: " + id);
    }

    return ListenerResult(true, std::nullopt);
  }

  ListenerResult initializeSQLite(const std::string& databaseName,
                                   const std::string& databasePath) override {
    std::lock_guard<std::mutex> lock(_mutex);

    // Check if already initialized
    if (_sqliteDatabases.find(databaseName) != _sqliteDatabases.end()) {
      if (_debugMode) {
        logDebug("SQLite database already initialized: " + databaseName);
      }
      return ListenerResult(true, std::nullopt);
    }

    // Open SQLite database
    sqlite3* db = nullptr;
    int rc = sqlite3_open(databasePath.c_str(), &db);

    if (rc != SQLITE_OK) {
      std::string error = sqlite3_errmsg(db);
      sqlite3_close(db);
      return ListenerResult(false, "Failed to open SQLite database: " + error);
    }

    // Enable WAL mode for better concurrency
    char* errMsg = nullptr;
    sqlite3_exec(db, "PRAGMA journal_mode=WAL;", nullptr, nullptr, &errMsg);
    if (errMsg) {
      sqlite3_free(errMsg);
    }

    // Store the database handle
    _sqliteDatabases[databaseName] = db;
    _sqliteDatabasePaths[databaseName] = databasePath;

    if (_debugMode) {
      logDebug("Initialized SQLite database: " + databaseName + " at " + databasePath);
    }

    return ListenerResult(true, std::nullopt);
  }

  bool isMMKVInitialized(const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");
    return _mmkvInstances.find(id) != _mmkvInstances.end();
  }

  bool isSQLiteInitialized(const std::optional<std::string>& databaseName) override {
    std::lock_guard<std::mutex> lock(_mutex);
    if (!databaseName.has_value()) {
      return !_sqliteDatabases.empty();
    }
    auto it = _sqliteDatabases.find(databaseName.value());
    return it != _sqliteDatabases.end() && it->second != nullptr;
  }

  // =========================================================================
  // Manual Change Checks
  // =========================================================================

  void checkMMKVChanges() override {
    // TODO: Implement MMKV change detection
    if (_debugMode) {
      logDebug("Checking MMKV changes");
    }
  }

  void checkSQLiteChanges(const std::string& databaseName,
                          const std::optional<std::string>& table) override {
    // TODO: Implement SQLite change detection
    if (_debugMode) {
      std::string msg = "Checking SQLite changes for database: " + databaseName;
      if (table.has_value()) {
        msg += ", table: " + table.value();
      }
      logDebug(msg);
    }
  }

  // =========================================================================
  // Debug Mode
  // =========================================================================

  bool isDebugMode() override {
    return _debugMode;
  }

  void setDebugMode(bool enabled) override {
    _debugMode = enabled;
  }

  // =========================================================================
  // Version
  // =========================================================================

  std::string getVersion() override {
    return "1.0.0";
  }

  // =========================================================================
  // Storage Write/Read Methods
  // =========================================================================

  ListenerResult setMMKV(const std::string& key,
                          const std::variant<bool, std::string, double>& value,
                          const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Validate MMKV instance is initialized
    if (_mmkvInstances.find(id) == _mmkvInstances.end()) {
      return ListenerResult(false, "MMKV instance '" + id + "' not initialized");
    }

    // Get the MMKV instance
    MMKV* mmkv = getMMKVInstance(id);
    if (mmkv == nullptr) {
      return ListenerResult(false, "Failed to get MMKV instance: " + id);
    }

    // Set value based on type
    bool success = false;
    if (std::holds_alternative<bool>(value)) {
      success = mmkv->set(std::get<bool>(value), key);
    } else if (std::holds_alternative<std::string>(value)) {
      success = mmkv->set(std::get<std::string>(value), key);
    } else if (std::holds_alternative<double>(value)) {
      success = mmkv->set(std::get<double>(value), key);
    }

    if (!success) {
      return ListenerResult(false, "Failed to set MMKV key: " + key);
    }

    if (_debugMode) {
      logDebug("Set MMKV key '" + key + "' in instance '" + id + "'");
    }

    return ListenerResult(true, std::nullopt);
  }

  std::variant<nitro::NullType, bool, std::string, double> getMMKV(
      const std::string& key,
      const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Check if instance is initialized
    if (_mmkvInstances.find(id) == _mmkvInstances.end()) {
      return nitro::NullType();
    }

    // Get the MMKV instance
    MMKV* mmkv = getMMKVInstance(id);
    if (mmkv == nullptr) {
      return nitro::NullType();
    }

    // Check if key exists
    if (!mmkv->containsKey(key)) {
      return nitro::NullType();
    }

    // Try to get the value - we need to determine the type
    // MMKV doesn't store type info, so we try each type in order
    // First try string (most common for JSON data)
    std::string stringValue;
    if (mmkv->getString(key, stringValue)) {
      // Check if it's a JSON boolean or number encoded as string
      if (stringValue == "true") {
        return true;
      } else if (stringValue == "false") {
        return false;
      }
      // Try to parse as double
      try {
        size_t pos;
        double doubleValue = std::stod(stringValue, &pos);
        if (pos == stringValue.length()) {
          return doubleValue;
        }
      } catch (...) {
        // Not a number, return as string
      }
      return stringValue;
    }

    // Try bool
    bool hasValue = false;
    bool boolValue = mmkv->getBool(key, false, &hasValue);
    if (hasValue) {
      return boolValue;
    }

    // Try double
    double doubleValue = mmkv->getDouble(key, 0.0, &hasValue);
    if (hasValue) {
      return doubleValue;
    }

    return nitro::NullType();
  }

  ListenerResult deleteMMKV(const std::string& key,
                            const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Check if instance is initialized
    if (_mmkvInstances.find(id) == _mmkvInstances.end()) {
      return ListenerResult(false, "MMKV instance '" + id + "' not initialized");
    }

    // Get the MMKV instance
    MMKV* mmkv = getMMKVInstance(id);
    if (mmkv == nullptr) {
      return ListenerResult(false, "Failed to get MMKV instance: " + id);
    }

    // Check if key exists
    if (!mmkv->containsKey(key)) {
      return ListenerResult(false, "Key '" + key + "' not found");
    }

    // Remove the key
    mmkv->removeValueForKey(key);

    if (_debugMode) {
      logDebug("Deleted MMKV key '" + key + "' from instance '" + id + "'");
    }

    return ListenerResult(true, std::nullopt);
  }

  ListenerResult executeSQLite(
      const std::string& sql,
      const std::optional<std::vector<std::variant<nitro::NullType, bool, std::string, double>>>& params,
      const std::optional<std::string>& databaseName) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string dbName = databaseName.value_or("default");

    // Check if database exists
    auto dbIt = _sqliteDatabases.find(dbName);
    if (dbIt == _sqliteDatabases.end() || dbIt->second == nullptr) {
      return ListenerResult(false, "SQLite database '" + dbName + "' not initialized");
    }

    sqlite3* db = dbIt->second;

    if (_debugMode) {
      logDebug("Execute SQL on database '" + dbName + "': " + sql);
    }

    // Prepare statement
    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);

    if (rc != SQLITE_OK) {
      std::string error = sqlite3_errmsg(db);
      return ListenerResult(false, "SQL prepare error: " + error);
    }

    // Bind parameters if provided
    if (params.has_value()) {
      const auto& paramVec = params.value();
      for (size_t i = 0; i < paramVec.size(); ++i) {
        int paramIndex = static_cast<int>(i + 1);  // SQLite params are 1-indexed
        const auto& param = paramVec[i];

        if (std::holds_alternative<nitro::NullType>(param)) {
          sqlite3_bind_null(stmt, paramIndex);
        } else if (std::holds_alternative<bool>(param)) {
          sqlite3_bind_int(stmt, paramIndex, std::get<bool>(param) ? 1 : 0);
        } else if (std::holds_alternative<std::string>(param)) {
          const std::string& str = std::get<std::string>(param);
          sqlite3_bind_text(stmt, paramIndex, str.c_str(), static_cast<int>(str.length()), SQLITE_TRANSIENT);
        } else if (std::holds_alternative<double>(param)) {
          sqlite3_bind_double(stmt, paramIndex, std::get<double>(param));
        }
      }
    }

    // Execute statement
    rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE && rc != SQLITE_ROW) {
      std::string error = sqlite3_errmsg(db);
      return ListenerResult(false, "SQL execution error: " + error);
    }

    return ListenerResult(true, std::nullopt);
  }

  std::variant<nitro::NullType, std::string> querySQLite(
      const std::string& sql,
      const std::optional<std::vector<std::variant<nitro::NullType, bool, std::string, double>>>& params,
      const std::optional<std::string>& databaseName) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string dbName = databaseName.value_or("default");

    // Check if database exists
    auto dbIt = _sqliteDatabases.find(dbName);
    if (dbIt == _sqliteDatabases.end() || dbIt->second == nullptr) {
      return nitro::NullType();
    }

    sqlite3* db = dbIt->second;

    if (_debugMode) {
      logDebug("Query SQL on database '" + dbName + "': " + sql);
    }

    // Prepare statement
    sqlite3_stmt* stmt = nullptr;
    int rc = sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);

    if (rc != SQLITE_OK) {
      std::string error = sqlite3_errmsg(db);
      logDebug("SQL prepare error: " + error);
      return nitro::NullType();
    }

    // Bind parameters if provided
    if (params.has_value()) {
      const auto& paramVec = params.value();
      for (size_t i = 0; i < paramVec.size(); ++i) {
        int paramIndex = static_cast<int>(i + 1);
        const auto& param = paramVec[i];

        if (std::holds_alternative<nitro::NullType>(param)) {
          sqlite3_bind_null(stmt, paramIndex);
        } else if (std::holds_alternative<bool>(param)) {
          sqlite3_bind_int(stmt, paramIndex, std::get<bool>(param) ? 1 : 0);
        } else if (std::holds_alternative<std::string>(param)) {
          const std::string& str = std::get<std::string>(param);
          sqlite3_bind_text(stmt, paramIndex, str.c_str(), static_cast<int>(str.length()), SQLITE_TRANSIENT);
        } else if (std::holds_alternative<double>(param)) {
          sqlite3_bind_double(stmt, paramIndex, std::get<double>(param));
        }
      }
    }

    // Collect results as JSON array
    std::ostringstream jsonStream;
    jsonStream << "[";

    int columnCount = sqlite3_column_count(stmt);
    bool firstRow = true;

    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
      if (!firstRow) {
        jsonStream << ",";
      }
      firstRow = false;

      jsonStream << "{";

      for (int col = 0; col < columnCount; ++col) {
        if (col > 0) {
          jsonStream << ",";
        }

        const char* colName = sqlite3_column_name(stmt, col);
        jsonStream << "\"" << escapeJsonString(colName) << "\":";

        int colType = sqlite3_column_type(stmt, col);
        switch (colType) {
          case SQLITE_NULL:
            jsonStream << "null";
            break;
          case SQLITE_INTEGER:
            jsonStream << sqlite3_column_int64(stmt, col);
            break;
          case SQLITE_FLOAT:
            jsonStream << sqlite3_column_double(stmt, col);
            break;
          case SQLITE_TEXT: {
            const char* text = reinterpret_cast<const char*>(sqlite3_column_text(stmt, col));
            jsonStream << "\"" << escapeJsonString(text ? text : "") << "\"";
            break;
          }
          case SQLITE_BLOB:
            // Convert blob to base64 or skip - for simplicity, output as null
            jsonStream << "null";
            break;
          default:
            jsonStream << "null";
            break;
        }
      }

      jsonStream << "}";
    }

    sqlite3_finalize(stmt);

    if (rc != SQLITE_DONE) {
      std::string error = sqlite3_errmsg(db);
      logDebug("SQL step error: " + error);
      return nitro::NullType();
    }

    jsonStream << "]";
    return jsonStream.str();
  }

private:
  // Internal listener entry structure
  struct ListenerEntry {
    std::string id;
    ListenerConfig config;
    double createdAt;
    double triggerCount;
    std::optional<double> lastTriggered;
    bool isPaused;

    // Throttle state - tracks when callback can next be called
    std::optional<double> nextAllowedTrigger;
    // Pending event waiting for throttle window
    bool hasPendingEvent;
  };

  // Thread safety
  std::mutex _mutex;

  // Listener storage
  std::map<std::string, ListenerEntry> _listeners;

  // Configuration
  bool _debugMode;
  size_t _maxListeners;

  // Initialized storage instances
  std::set<std::string> _mmkvInstances;
  std::map<std::string, std::string> _sqliteDatabasePaths;

  // SQLite database handles
  std::map<std::string, sqlite3*> _sqliteDatabases;

  // MMKV global initialization state
  bool _mmkvGlobalInitialized = false;
  std::string _mmkvRootPath;  // Empty string means use MMKV's default path

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Get an MMKV instance by ID
   * Handles cross-platform differences in the MMKV API
   */
  MMKV* getMMKVInstance(const std::string& id) {
#ifdef __ANDROID__
    // Android version has an additional size parameter
    return MMKV::mmkvWithID(id, mmkv::DEFAULT_MMAP_SIZE, MMKV_SINGLE_PROCESS);
#else
    // iOS/macOS version
    return MMKV::mmkvWithID(id, MMKV_SINGLE_PROCESS);
#endif
  }

  /**
   * Get the platform-specific default MMKV path
   * Internal version that can be called without override
   */
  std::string getDefaultMMKVPathInternal() {
#ifdef __APPLE__
    // iOS/macOS: Use Library directory (same as react-native-mmkv)
    @autoreleasepool {
      NSArray *paths = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES);
      NSString *libraryPath = [paths firstObject];
      NSString *mmkvPath = [libraryPath stringByAppendingPathComponent:@"mmkv"];
      return std::string([mmkvPath UTF8String]);
    }
#else
    // Android: Return the path if already set, otherwise empty
    // Android path must be set from Java side (Context.getFilesDir() + "/mmkv")
    return _mmkvRootPath;
#endif
  }

  double getCurrentTimestamp() const {
    return static_cast<double>(
        std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch())
            .count());
  }

  ListenerInfo createListenerInfo(const ListenerEntry& entry) const {
    return ListenerInfo(
        entry.id,
        entry.config,
        entry.createdAt,
        entry.triggerCount,
        entry.lastTriggered,
        entry.isPaused);
  }

  void logDebug(const std::string& message) const {
    // Simple debug logging - can be enhanced per platform
    std::cout << "[SAM] " << message << std::endl;
  }

  /**
   * Escape a string for JSON output
   */
  std::string escapeJsonString(const std::string& str) const {
    std::ostringstream result;
    for (char c : str) {
      switch (c) {
        case '"':  result << "\\\""; break;
        case '\\': result << "\\\\"; break;
        case '\b': result << "\\b";  break;
        case '\f': result << "\\f";  break;
        case '\n': result << "\\n";  break;
        case '\r': result << "\\r";  break;
        case '\t': result << "\\t";  break;
        default:
          if ('\x00' <= c && c <= '\x1f') {
            // Control characters - output as unicode escape
            result << "\\u" << std::hex << std::setfill('0') << std::setw(4) << static_cast<int>(c);
          } else {
            result << c;
          }
          break;
      }
    }
    return result.str();
  }

  /**
   * Check if a listener can fire based on throttle settings.
   * Returns true if the callback can be invoked now.
   * If false, the event should be queued for later dispatch.
   *
   * @param entry The listener entry to check
   * @param currentTime Current timestamp in milliseconds
   * @return true if callback can fire, false if throttled
   */
  bool canFireCallback(ListenerEntry& entry, double currentTime) {
    // Check if listener is paused
    if (entry.isPaused) {
      return false;
    }

    // Check throttle settings
    if (entry.config.options.has_value()) {
      const auto& options = entry.config.options.value();
      if (options.throttleMs.has_value()) {
        double throttleMs = options.throttleMs.value();

        // Check if we're within the throttle window
        if (entry.nextAllowedTrigger.has_value()) {
          if (currentTime < entry.nextAllowedTrigger.value()) {
            // Still within throttle window - mark pending and don't fire
            entry.hasPendingEvent = true;
            if (_debugMode) {
              double waitMs = entry.nextAllowedTrigger.value() - currentTime;
              logDebug("Listener " + entry.id + " throttled, wait " +
                       std::to_string(static_cast<int>(waitMs)) + "ms");
            }
            return false;
          }
        }

        // Can fire - update next allowed trigger time
        entry.nextAllowedTrigger = currentTime + throttleMs;
      }
    }

    // Update trigger stats
    entry.triggerCount++;
    entry.lastTriggered = currentTime;
    entry.hasPendingEvent = false;

    return true;
  }

  /**
   * Record that a callback was fired for a listener.
   * Updates trigger count and timestamp.
   */
  void recordTrigger(const std::string& id) {
    auto it = _listeners.find(id);
    if (it != _listeners.end()) {
      double currentTime = getCurrentTimestamp();
      it->second.triggerCount++;
      it->second.lastTriggered = currentTime;

      // Update throttle window if applicable
      if (it->second.config.options.has_value()) {
        const auto& options = it->second.config.options.value();
        if (options.throttleMs.has_value()) {
          it->second.nextAllowedTrigger = currentTime + options.throttleMs.value();
        }
      }
    }
  }
};

} // namespace margelo::nitro::sam
