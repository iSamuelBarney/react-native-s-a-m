#pragma once

#include "../nitrogen/generated/shared/c++/HybridSideFxSpec.hpp"
#include "../nitrogen/generated/shared/c++/ListenerConfig.hpp"
#include "../nitrogen/generated/shared/c++/ListenerInfo.hpp"
#include "../nitrogen/generated/shared/c++/ListenerResult.hpp"
#include "../nitrogen/generated/shared/c++/SAMConfig.hpp"
#include "../nitrogen/generated/shared/c++/NetworkState.hpp"
#include "../nitrogen/generated/shared/c++/NetworkStatus.hpp"
#include "../nitrogen/generated/shared/c++/ConnectionType.hpp"
#include "../nitrogen/generated/shared/c++/CellularGeneration.hpp"
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
#include <MMKVCore/MMKV.h>

// Platform-specific includes for path detection and network monitoring
#ifdef __APPLE__
#import <Foundation/Foundation.h>
#import <Network/Network.h>
#import <SystemConfiguration/SystemConfiguration.h>
#import <CoreTelephony/CTTelephonyNetworkInfo.h>
#import <CoreTelephony/CTCarrier.h>
#endif

#ifdef __ANDROID__
// Android-specific includes would go here
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
    if (!config.warm.has_value() && !config.cold.has_value() &&
        !config.combined.has_value()) {
      return ListenerResult(false, "At least one of warm, cold, or combined must be specified");
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

  std::string getDefaultWarmPath() override {
    return getDefaultWarmPathInternal();
  }

  void setWarmRootPath(const std::string& rootPath) override {
    std::lock_guard<std::mutex> lock(_mutex);
    if (_warmGlobalInitialized) {
      logDebug("Warning: Warm storage already initialized, setWarmRootPath has no effect");
      return;
    }
    _warmRootPath = rootPath;
    if (_debugMode) {
      logDebug("Warm storage root path set to: " + rootPath);
    }
  }

  ListenerResult initializeWarm(const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Check if already initialized in our tracking
    if (_warmInstances.find(id) != _warmInstances.end()) {
      if (_debugMode) {
        logDebug("Warm instance already initialized: " + id);
      }
      return ListenerResult(true, std::nullopt);
    }

    // Initialize Warm storage globally if not done yet
    // This uses the same default path that react-native-mmkv uses,
    // so storage is shared if both libraries are present
    if (!_warmGlobalInitialized) {
      // Auto-detect default path if not explicitly set
      if (_warmRootPath.empty()) {
        _warmRootPath = getDefaultWarmPathInternal();
        if (_warmRootPath.empty()) {
          return ListenerResult(false,
            "Warm root path not set and could not auto-detect. "
            "Call setWarmRootPath() first with your app's files directory + '/mmkv'");
        }
        if (_debugMode) {
          logDebug("Auto-detected Warm root path: " + _warmRootPath);
        }
      }

      // Initialize MMKV with the configured root path
      mmkv::MMKV::initializeMMKV(_warmRootPath);
      _warmGlobalInitialized = true;
      if (_debugMode) {
        logDebug("Warm storage globally initialized at: " + _warmRootPath);
      }
    }

    // Get or create the Warm instance
    mmkv::MMKV* warmInstance = getWarmInstance(id);
    if (warmInstance == nullptr) {
      return ListenerResult(false, "Failed to create Warm instance: " + id);
    }

    _warmInstances.insert(id);

    if (_debugMode) {
      logDebug("Initialized Warm instance: " + id);
    }

    return ListenerResult(true, std::nullopt);
  }

  ListenerResult initializeCold(const std::string& databaseName,
                                   const std::string& databasePath) override {
    std::lock_guard<std::mutex> lock(_mutex);

    // Check if already initialized
    if (_sqliteDatabases.find(databaseName) != _sqliteDatabases.end()) {
      if (_debugMode) {
        logDebug("Cold storage database already initialized: " + databaseName);
      }
      return ListenerResult(true, std::nullopt);
    }

    // Open SQLite database
    sqlite3* db = nullptr;
    int rc = sqlite3_open(databasePath.c_str(), &db);

    if (rc != SQLITE_OK) {
      std::string error = sqlite3_errmsg(db);
      sqlite3_close(db);
      return ListenerResult(false, "Failed to open Cold storage database: " + error);
    }

    // Enable WAL mode for better concurrency
    char* errMsg = nullptr;
    sqlite3_exec(db, "PRAGMA journal_mode=WAL;", nullptr, nullptr, &errMsg);
    if (errMsg) {
      sqlite3_free(errMsg);
    }

    // Store the database handle
    _sqliteDatabases[databaseName] = db;
    _coldDatabasePaths[databaseName] = databasePath;

    if (_debugMode) {
      logDebug("Initialized Cold storage database: " + databaseName + " at " + databasePath);
    }

    return ListenerResult(true, std::nullopt);
  }

  bool isWarmInitialized(const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");
    return _warmInstances.find(id) != _warmInstances.end();
  }

  bool isColdInitialized(const std::optional<std::string>& databaseName) override {
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

  void checkWarmChanges() override {
    // TODO: Implement Warm storage change detection
    if (_debugMode) {
      logDebug("Checking Warm storage changes");
    }
  }

  void checkColdChanges(const std::string& databaseName,
                          const std::optional<std::string>& table) override {
    // TODO: Implement Cold storage change detection
    if (_debugMode) {
      std::string msg = "Checking Cold storage changes for database: " + databaseName;
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

  ListenerResult setWarm(const std::string& key,
                          const std::variant<bool, std::string, double>& value,
                          const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Validate Warm instance is initialized
    if (_warmInstances.find(id) == _warmInstances.end()) {
      return ListenerResult(false, "Warm instance '" + id + "' not initialized");
    }

    // Get the Warm instance
    mmkv::MMKV* warmStorage = getWarmInstance(id);
    if (warmStorage == nullptr) {
      return ListenerResult(false, "Failed to get Warm instance: " + id);
    }

    // Set value based on type
    bool success = false;
    if (std::holds_alternative<bool>(value)) {
      success = warmStorage->set(std::get<bool>(value), key);
    } else if (std::holds_alternative<std::string>(value)) {
      success = warmStorage->set(std::get<std::string>(value), key);
    } else if (std::holds_alternative<double>(value)) {
      success = warmStorage->set(std::get<double>(value), key);
    }

    if (!success) {
      return ListenerResult(false, "Failed to set Warm key: " + key);
    }

    if (_debugMode) {
      logDebug("Set Warm key '" + key + "' in instance '" + id + "'");
    }

    return ListenerResult(true, std::nullopt);
  }

  std::variant<nitro::NullType, bool, std::string, double> getWarm(
      const std::string& key,
      const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Check if instance is initialized
    if (_warmInstances.find(id) == _warmInstances.end()) {
      return nitro::NullType();
    }

    // Get the Warm instance
    mmkv::MMKV* warmStorage = getWarmInstance(id);
    if (warmStorage == nullptr) {
      return nitro::NullType();
    }

    // Check if key exists
    if (!warmStorage->containsKey(key)) {
      return nitro::NullType();
    }

    // Try to get the value - we need to determine the type
    // MMKV doesn't store type info, so we try each type in order
    // First try string (most common for JSON data)
    std::string stringValue;
    if (warmStorage->getString(key, stringValue)) {
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
    bool boolValue = warmStorage->getBool(key, false, &hasValue);
    if (hasValue) {
      return boolValue;
    }

    // Try double
    double doubleValue = warmStorage->getDouble(key, 0.0, &hasValue);
    if (hasValue) {
      return doubleValue;
    }

    return nitro::NullType();
  }

  ListenerResult deleteWarm(const std::string& key,
                            const std::optional<std::string>& instanceId) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string id = instanceId.value_or("default");

    // Check if instance is initialized
    if (_warmInstances.find(id) == _warmInstances.end()) {
      return ListenerResult(false, "Warm instance '" + id + "' not initialized");
    }

    // Get the Warm instance
    mmkv::MMKV* warmStorage = getWarmInstance(id);
    if (warmStorage == nullptr) {
      return ListenerResult(false, "Failed to get Warm instance: " + id);
    }

    // Check if key exists
    if (!warmStorage->containsKey(key)) {
      return ListenerResult(false, "Key '" + key + "' not found");
    }

    // Remove the key
    warmStorage->removeValueForKey(key);

    if (_debugMode) {
      logDebug("Deleted Warm key '" + key + "' from instance '" + id + "'");
    }

    return ListenerResult(true, std::nullopt);
  }

  ListenerResult executeCold(
      const std::string& sql,
      const std::optional<std::vector<std::variant<nitro::NullType, bool, std::string, double>>>& params,
      const std::optional<std::string>& databaseName) override {
    std::lock_guard<std::mutex> lock(_mutex);
    std::string dbName = databaseName.value_or("default");

    // Check if database exists
    auto dbIt = _sqliteDatabases.find(dbName);
    if (dbIt == _sqliteDatabases.end() || dbIt->second == nullptr) {
      return ListenerResult(false, "Cold storage database '" + dbName + "' not initialized");
    }

    sqlite3* db = dbIt->second;

    if (_debugMode) {
      logDebug("Execute SQL on Cold storage '" + dbName + "': " + sql);
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

  std::variant<nitro::NullType, std::string> queryCold(
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
      logDebug("Query Cold storage '" + dbName + "': " + sql);
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

  // =========================================================================
  // Network Monitoring
  // =========================================================================

  ListenerResult startNetworkMonitoring() override {
    std::lock_guard<std::mutex> lock(_mutex);

    if (_networkMonitoringActive) {
      return ListenerResult(true, std::nullopt);
    }

#ifdef __APPLE__
    @autoreleasepool {
      // Create the path monitor
      _networkPathMonitor = nw_path_monitor_create();

      // Set the queue
      _networkQueue = dispatch_queue_create("com.sam.network", DISPATCH_QUEUE_SERIAL);
      nw_path_monitor_set_queue(_networkPathMonitor, _networkQueue);

      // Capture this pointer for the callback
      HybridSideFx* self = this;

      // Set the update handler
      nw_path_monitor_set_update_handler(_networkPathMonitor, ^(nw_path_t path) {
        self->updateNetworkStateFromPath(path);
        // Also check internet quality when network changes
        self->checkInternetQualityAsync();
      });

      // Start monitoring
      nw_path_monitor_start(_networkPathMonitor);

      // Start periodic internet quality checks
      // - In active mode: every 10 seconds for quality monitoring
      // - In passive mode (offline recovery): every 30 seconds to detect when back online
      // The timer always runs at 30s, but checkInternetQualityAsync() decides whether to actually ping
      _pingTimer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, _networkQueue);
      uint64_t intervalNs = _useActivePing ? (10 * NSEC_PER_SEC) : (30 * NSEC_PER_SEC);
      dispatch_source_set_timer(_pingTimer, dispatch_time(DISPATCH_TIME_NOW, 0), intervalNs, 1 * NSEC_PER_SEC);
      dispatch_source_set_event_handler(_pingTimer, ^{
        self->checkInternetQualityAsync();
      });
      dispatch_resume(_pingTimer);

      _networkMonitoringActive = true;

      if (_debugMode) {
        logDebug("Network monitoring started with internet quality checks");
      }
    }
#else
    // Android implementation would go here
    _networkMonitoringActive = true;
#endif

    return ListenerResult(true, std::nullopt);
  }

  ListenerResult stopNetworkMonitoring() override {
    std::lock_guard<std::mutex> lock(_mutex);

    if (!_networkMonitoringActive) {
      return ListenerResult(true, std::nullopt);
    }

#ifdef __APPLE__
    if (_pingTimer != nullptr) {
      dispatch_source_cancel(_pingTimer);
      _pingTimer = nullptr;
    }
    if (_networkPathMonitor != nullptr) {
      nw_path_monitor_cancel(_networkPathMonitor);
      _networkPathMonitor = nullptr;
    }
#endif

    _networkMonitoringActive = false;

    if (_debugMode) {
      logDebug("Network monitoring stopped");
    }

    return ListenerResult(true, std::nullopt);
  }

  bool isNetworkMonitoringActive() override {
    return _networkMonitoringActive;
  }

  NetworkState getNetworkState() override {
    std::lock_guard<std::mutex> lock(_mutex);
    return _currentNetworkState;
  }

  void refreshNetworkState() override {
#ifdef __APPLE__
    // On iOS, the path monitor will automatically update
    // We can force a state update by querying current reachability
    @autoreleasepool {
      SCNetworkReachabilityRef reachability = SCNetworkReachabilityCreateWithName(NULL, "www.apple.com");
      if (reachability != NULL) {
        SCNetworkReachabilityFlags flags;
        if (SCNetworkReachabilityGetFlags(reachability, &flags)) {
          updateNetworkStateFromReachabilityFlags(flags);
        }
        CFRelease(reachability);
      }
    }
#else
    // Android implementation would go here
#endif

    if (_debugMode) {
      logDebug("Network state refreshed");
    }
  }

  void setActivePingMode(bool enabled) override {
    std::lock_guard<std::mutex> lock(_mutex);
    _useActivePing = enabled;

    if (_debugMode) {
      logDebug("Active ping mode " + std::string(enabled ? "enabled" : "disabled"));
    }

#ifdef __APPLE__
    // Update timer interval based on mode
    // Active: 10 seconds for quality monitoring
    // Passive: 30 seconds for offline recovery only
    if (_pingTimer != nullptr) {
      uint64_t intervalNs = enabled ? (10 * NSEC_PER_SEC) : (30 * NSEC_PER_SEC);
      dispatch_source_set_timer(_pingTimer, dispatch_time(DISPATCH_TIME_NOW, 0), intervalNs, 1 * NSEC_PER_SEC);
    }
#endif

    // If enabling active ping and network monitoring is already active, trigger a check now
    if (enabled && _networkMonitoringActive) {
      checkInternetQualityAsync();
    }
  }

  void reportNetworkLatency(double latencyMs) override {
    std::lock_guard<std::mutex> lock(_mutex);

    // Ignore invalid values
    if (latencyMs < 0) {
      return;
    }

    // Update latency and quality
    _lastPingLatencyMs = latencyMs;
    _internetQuality = latencyToQuality(latencyMs);

    // A successful network call means internet is reachable!
    // This is crucial for passive mode to work correctly.
    _internetReachable = true;
    _isCheckingOfflineRecovery = false;  // No longer need to check for recovery

    if (_debugMode) {
      logDebug("Reported network latency: " + std::to_string((int)latencyMs) + "ms, quality: " + _internetQuality + ", reachable: true");
    }

    // Update Warm storage with the new quality
    updateInternetQualityWarmKeys();
  }

  void reportNetworkFailure() override {
    std::lock_guard<std::mutex> lock(_mutex);

    // A network failure means internet may be unreachable
    _internetReachable = false;
    _internetQuality = "offline";
    _lastPingLatencyMs = -1;
    _isCheckingOfflineRecovery = true;  // Start checking for recovery

    if (_debugMode) {
      logDebug("Reported network failure - starting offline recovery checks");
    }

    // Update Warm storage
    updateInternetQualityWarmKeys();
  }

  void setPingEndpoints(const std::vector<std::string>& endpoints) override {
    std::lock_guard<std::mutex> lock(_mutex);

    // Empty array resets to defaults
    if (endpoints.empty()) {
      _customPingEndpoints.clear();
      if (_debugMode) {
        logDebug("Reset ping endpoints to defaults");
      }
    } else {
      _customPingEndpoints = endpoints;
      if (_debugMode) {
        logDebug("Set " + std::to_string(endpoints.size()) + " custom ping endpoints");
      }
    }

    // Reset endpoint index to start fresh with new endpoints
    _pingEndpointIndex = 0;
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
  std::set<std::string> _warmInstances;
  std::map<std::string, std::string> _coldDatabasePaths;

  // Cold storage database handles
  std::map<std::string, sqlite3*> _sqliteDatabases;

  // Warm storage global initialization state
  bool _warmGlobalInitialized = false;
  std::string _warmRootPath;  // Empty string means use MMKV's default path

  // Network monitoring state
  bool _networkMonitoringActive = false;
  NetworkState _currentNetworkState = NetworkState(
      NetworkStatus::UNKNOWN,
      ConnectionType::UNKNOWN,
      false,   // isConnected
      -1,      // isInternetReachable (-1 = unknown)
      CellularGeneration::UNKNOWN,
      -1,      // wifiStrength (-1 = unavailable)
      false,   // isConnectionExpensive
      0        // timestamp
  );

  // Internet quality tracking
  double _lastPingLatencyMs = -1;  // -1 = unknown, >= 0 = latency in ms
  std::string _internetQuality = "unknown";  // "excellent", "good", "fair", "poor", "offline", "unknown"
  bool _internetReachable = false;  // True if internet is actually reachable (single source of truth)
  bool _useActivePing = false;  // If true, use active HTTP pings. If false, rely on passive observation.
  int _pingEndpointIndex = 0;  // Current endpoint index for round-robin
  bool _isCheckingOfflineRecovery = false;  // If true, we're in offline state doing recovery checks
  std::vector<std::string> _customPingEndpoints;  // User-defined endpoints (empty = use defaults)

#ifdef __APPLE__
  nw_path_monitor_t _networkPathMonitor = nullptr;
  dispatch_queue_t _networkQueue = nullptr;
  dispatch_source_t _pingTimer = nullptr;
#endif

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Get a Warm storage (MMKV) instance by ID
   * Handles cross-platform differences in the MMKV API
   */
  mmkv::MMKV* getWarmInstance(const std::string& id) {
#ifdef __ANDROID__
    // Android version has an additional size parameter
    return mmkv::MMKV::mmkvWithID(id, mmkv::DEFAULT_MMAP_SIZE, mmkv::MMKV_SINGLE_PROCESS);
#else
    // iOS/macOS version
    return mmkv::MMKV::mmkvWithID(id, mmkv::MMKV_SINGLE_PROCESS);
#endif
  }

  /**
   * Get the platform-specific default Warm storage path
   * Internal version that can be called without override
   */
  std::string getDefaultWarmPathInternal() {
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
    return _warmRootPath;
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

#ifdef __APPLE__
  /**
   * Update network state from NWPath (iOS Network framework)
   */
  void updateNetworkStateFromPath(nw_path_t path) {
    std::lock_guard<std::mutex> lock(_mutex);

    nw_path_status_t status = nw_path_get_status(path);
    bool isConnected = (status == nw_path_status_satisfied || status == nw_path_status_satisfiable);

    // Determine connection type
    ConnectionType connType = ConnectionType::UNKNOWN;
    bool isExpensive = nw_path_is_expensive(path);

    if (nw_path_uses_interface_type(path, nw_interface_type_wifi)) {
      connType = ConnectionType::WIFI;
    } else if (nw_path_uses_interface_type(path, nw_interface_type_cellular)) {
      connType = ConnectionType::CELLULAR;
    } else if (nw_path_uses_interface_type(path, nw_interface_type_wired)) {
      connType = ConnectionType::ETHERNET;
    } else if (!isConnected) {
      connType = ConnectionType::NONE;
    }

    // Determine network status (online/offline/unknown)
    NetworkStatus netStatus = NetworkStatus::UNKNOWN;
    if (status == nw_path_status_satisfied) {
      netStatus = NetworkStatus::ONLINE;
    } else if (status == nw_path_status_unsatisfied) {
      netStatus = NetworkStatus::OFFLINE;
    }

    // Get cellular generation if on cellular
    CellularGeneration cellGen = CellularGeneration::UNKNOWN;
    if (connType == ConnectionType::CELLULAR) {
      cellGen = getCellularGeneration();
    }

    // Update state
    _currentNetworkState = NetworkState(
        netStatus,
        connType,
        isConnected,
        isConnected ? 1 : 0,  // isInternetReachable (simplified)
        cellGen,
        -1,  // wifiStrength not available via Network framework
        isExpensive,
        getCurrentTimestamp()
    );

    // Store in Warm storage for reactive listeners
    updateNetworkWarmKeys();

    if (_debugMode) {
      logDebug("Network state updated: " + networkStatusToString(netStatus) +
               ", type: " + connectionTypeToString(connType));
    }
  }

  /**
   * Update network state from SCNetworkReachability flags
   */
  void updateNetworkStateFromReachabilityFlags(SCNetworkReachabilityFlags flags) {
    bool isReachable = (flags & kSCNetworkReachabilityFlagsReachable) != 0;
    bool needsConnection = (flags & kSCNetworkReachabilityFlagsConnectionRequired) != 0;
    bool isConnected = isReachable && !needsConnection;

    ConnectionType connType = ConnectionType::UNKNOWN;
    if (!isConnected) {
      connType = ConnectionType::NONE;
    } else if (flags & kSCNetworkReachabilityFlagsIsWWAN) {
      connType = ConnectionType::CELLULAR;
    } else {
      connType = ConnectionType::WIFI;
    }

    NetworkStatus netStatus = isConnected ? NetworkStatus::ONLINE : NetworkStatus::OFFLINE;

    CellularGeneration cellGen = CellularGeneration::UNKNOWN;
    if (connType == ConnectionType::CELLULAR) {
      cellGen = getCellularGeneration();
    }

    _currentNetworkState = NetworkState(
        netStatus,
        connType,
        isConnected,
        isConnected ? 1 : 0,
        cellGen,
        -1,
        (flags & kSCNetworkReachabilityFlagsIsWWAN) != 0,
        getCurrentTimestamp()
    );

    updateNetworkWarmKeys();
  }

  /**
   * Get cellular generation from CoreTelephony
   */
  CellularGeneration getCellularGeneration() {
    @autoreleasepool {
      CTTelephonyNetworkInfo *networkInfo = [[CTTelephonyNetworkInfo alloc] init];
      NSString *radioAccess = nil;

      if (@available(iOS 12.0, *)) {
        NSDictionary *radioDict = networkInfo.serviceCurrentRadioAccessTechnology;
        radioAccess = radioDict.allValues.firstObject;
      } else {
        radioAccess = networkInfo.currentRadioAccessTechnology;
      }

      if (radioAccess == nil) {
        return CellularGeneration::UNKNOWN;
      }

      // 5G
      if (@available(iOS 14.1, *)) {
        if ([radioAccess isEqualToString:CTRadioAccessTechnologyNRNSA] ||
            [radioAccess isEqualToString:CTRadioAccessTechnologyNR]) {
          return CellularGeneration::_5G;
        }
      }

      // 4G/LTE
      if ([radioAccess isEqualToString:CTRadioAccessTechnologyLTE]) {
        return CellularGeneration::_4G;
      }

      // 3G
      if ([radioAccess isEqualToString:CTRadioAccessTechnologyWCDMA] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyHSDPA] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyHSUPA] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyCDMA1x] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyCDMAEVDORev0] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyCDMAEVDORevA] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyCDMAEVDORevB] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyeHRPD]) {
        return CellularGeneration::_3G;
      }

      // 2G
      if ([radioAccess isEqualToString:CTRadioAccessTechnologyGPRS] ||
          [radioAccess isEqualToString:CTRadioAccessTechnologyEdge]) {
        return CellularGeneration::_2G;
      }

      return CellularGeneration::UNKNOWN;
    }
  }

  /**
   * Update Warm storage keys with current network state
   * This allows JS components to subscribe via useWarm
   */
  void updateNetworkWarmKeys() {
    // Ensure Warm is initialized for network state
    if (_warmInstances.find("sam-network") == _warmInstances.end()) {
      // Auto-initialize network Warm instance
      if (_warmGlobalInitialized || !_warmRootPath.empty() || !getDefaultWarmPathInternal().empty()) {
        if (!_warmGlobalInitialized) {
          std::string path = _warmRootPath.empty() ? getDefaultWarmPathInternal() : _warmRootPath;
          if (!path.empty()) {
            mmkv::MMKV::initializeMMKV(path);
            _warmGlobalInitialized = true;
          }
        }
        if (_warmGlobalInitialized) {
          _warmInstances.insert("sam-network");
        }
      }
    }

    if (_warmInstances.find("sam-network") == _warmInstances.end()) {
      return;  // Can't store without Warm
    }

    mmkv::MMKV* storage = getWarmInstance("sam-network");
    if (storage == nullptr) return;

    // Store simplified network status for easy subscription
    // Values: "online", "offline", "unknown"
    storage->set(networkStatusToString(_currentNetworkState.status), "NETWORK_STATUS");

    // Store connection type: "wifi", "cellular", "ethernet", "none", "unknown"
    storage->set(connectionTypeToString(_currentNetworkState.type), "NETWORK_TYPE");

    // Store signal quality indicator: "strong", "weak", "offline"
    std::string quality = "unknown";
    if (_currentNetworkState.status == NetworkStatus::OFFLINE ||
        _currentNetworkState.type == ConnectionType::NONE) {
      quality = "offline";
    } else if (_currentNetworkState.status == NetworkStatus::ONLINE) {
      if (_currentNetworkState.type == ConnectionType::WIFI ||
          _currentNetworkState.type == ConnectionType::ETHERNET) {
        quality = "strong";
      } else if (_currentNetworkState.type == ConnectionType::CELLULAR) {
        if (_currentNetworkState.cellularGeneration == CellularGeneration::_5G ||
            _currentNetworkState.cellularGeneration == CellularGeneration::_4G) {
          quality = "strong";
        } else if (_currentNetworkState.cellularGeneration == CellularGeneration::_3G) {
          quality = "medium";
        } else {
          quality = "weak";
        }
      }
    }
    storage->set(quality, "NETWORK_QUALITY");

    // Store cellular generation if applicable
    if (_currentNetworkState.type == ConnectionType::CELLULAR) {
      storage->set(cellularGenerationToString(_currentNetworkState.cellularGeneration), "CELLULAR_GENERATION");
    }

    // Store boolean for quick checks
    storage->set(_currentNetworkState.isConnected, "IS_CONNECTED");
  }

  std::string networkStatusToString(NetworkStatus status) const {
    switch (status) {
      case NetworkStatus::ONLINE: return "online";
      case NetworkStatus::OFFLINE: return "offline";
      default: return "unknown";
    }
  }

  std::string connectionTypeToString(ConnectionType type) const {
    switch (type) {
      case ConnectionType::WIFI: return "wifi";
      case ConnectionType::CELLULAR: return "cellular";
      case ConnectionType::ETHERNET: return "ethernet";
      case ConnectionType::BLUETOOTH: return "bluetooth";
      case ConnectionType::VPN: return "vpn";
      case ConnectionType::NONE: return "none";
      default: return "unknown";
    }
  }

  std::string cellularGenerationToString(CellularGeneration gen) const {
    switch (gen) {
      case CellularGeneration::_2G: return "2g";
      case CellularGeneration::_3G: return "3g";
      case CellularGeneration::_4G: return "4g";
      case CellularGeneration::_5G: return "5g";
      default: return "unknown";
    }
  }

  /**
   * Get list of ping endpoints for active internet quality checks
   * Returns custom endpoints if set, otherwise uses default endpoints
   */
  std::vector<std::string> getPingEndpoints() const {
    // Use custom endpoints if set
    if (!_customPingEndpoints.empty()) {
      return _customPingEndpoints;
    }

    // Default endpoints - uses multiple to avoid dependency on any single service
    return {
      "https://www.google.com/generate_204",      // Google's connectivity check
      "https://www.apple.com/library/test/success.html",  // Apple's connectivity check
      "https://clients3.google.com/generate_204", // Google alternate
      "https://captive.apple.com/hotspot-detect.html",    // Apple captive portal check
    };
  }

  /**
   * Check internet quality by measuring latency to a reliable endpoint
   * This runs asynchronously and updates Warm storage when complete
   *
   * In active mode (debug/simulator): Uses HTTP pings to measure latency
   * In passive mode (production): Relies on reportNetworkLatency() from app network calls
   *
   * OFFLINE RECOVERY: When offline, always performs a check every 30 seconds
   * to detect when internet becomes available again. This runs regardless of
   * active ping mode setting.
   */
  void checkInternetQualityAsync() {
    // If network layer says not connected, update state accordingly
    // But still check for offline recovery
    if (!_currentNetworkState.isConnected) {
      _lastPingLatencyMs = -1;
      _internetQuality = "offline";
      _internetReachable = false;
      updateInternetQualityWarmKeys();
      return;
    }

    // IMPORTANT: Offline recovery check - when we're in offline state,
    // always perform a check regardless of active ping mode.
    // This is crucial for apps to know when they can resume network operations.
    bool shouldCheckForRecovery = !_internetReachable || _isCheckingOfflineRecovery;

    // In passive mode, skip active pings UNLESS we need to check for offline recovery
    if (!_useActivePing && !shouldCheckForRecovery) {
      // Just ensure we have some quality assessment based on network type
      // Actual latency will come from app's network calls via reportNetworkLatency()
      if (_lastPingLatencyMs < 0) {
        // No latency data yet, use network-type-based assessment
        _internetQuality = "unknown";
        updateInternetQualityWarmKeys();
      }
      return;
    }

    @autoreleasepool {
      // Use NSURLSession to measure actual HTTP latency
      // This is more accurate than ping because it goes through the full network stack

      // Round-robin through endpoints to avoid hammering any single service
      auto endpoints = getPingEndpoints();
      std::string endpoint = endpoints[_pingEndpointIndex % endpoints.size()];
      _pingEndpointIndex++;

      NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:endpoint.c_str()]];
      NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
      request.HTTPMethod = @"HEAD";
      request.timeoutInterval = 10.0;
      request.cachePolicy = NSURLRequestReloadIgnoringLocalCacheData;

      // Capture self for the completion handler
      HybridSideFx* self = this;
      NSDate *startTime = [NSDate date];

      NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
          double latencyMs = -1;
          std::string quality = "unknown";
          bool reachable = false;

          if (error != nil) {
            // Request failed - internet may be unreachable
            if (self->_debugMode) {
              self->logDebug("Internet quality check failed: " + std::string([[error localizedDescription] UTF8String]));
            }
            quality = "offline";
            latencyMs = -1;
            reachable = false;
          } else {
            // Calculate latency
            NSTimeInterval elapsed = [[NSDate date] timeIntervalSinceDate:startTime];
            latencyMs = elapsed * 1000.0;

            // Determine quality based on latency
            quality = self->latencyToQuality(latencyMs);
            reachable = true;  // We got a successful response!

            if (self->_debugMode) {
              self->logDebug("Internet latency: " + std::to_string((int)latencyMs) + "ms, quality: " + quality + ", reachable: true");
            }
          }

          // Update state (need to lock)
          {
            std::lock_guard<std::mutex> lock(self->_mutex);
            self->_lastPingLatencyMs = latencyMs;
            self->_internetQuality = quality;
            self->_internetReachable = reachable;
            self->_isCheckingOfflineRecovery = !reachable;  // Keep checking if still offline
          }

          // Update Warm storage
          self->updateInternetQualityWarmKeys();
        }];

      [task resume];
    }
  }

  /**
   * Convert latency in ms to quality string
   * These thresholds are based on typical user experience expectations
   */
  std::string latencyToQuality(double latencyMs) const {
    if (latencyMs < 0) return "unknown";
    if (latencyMs < 100) return "excellent";  // < 100ms - very responsive
    if (latencyMs < 300) return "good";       // 100-300ms - good for most use cases
    if (latencyMs < 1000) return "fair";      // 300-1000ms - noticeable but usable
    return "poor";                             // > 1000ms - significant delays
  }

  /**
   * Update Warm storage with internet quality values
   */
  void updateInternetQualityWarmKeys() {
    if (_warmInstances.find("sam-network") == _warmInstances.end()) {
      return;
    }

    mmkv::MMKV* storage = getWarmInstance("sam-network");
    if (storage == nullptr) return;

    // Store internet quality: "excellent", "good", "fair", "poor", "offline", "unknown"
    storage->set(_internetQuality, "INTERNET_QUALITY");

    // Store latency in ms (-1 if unknown/offline)
    storage->set(_lastPingLatencyMs, "INTERNET_LATENCY_MS");

    // Store combined quality that considers both network type and internet quality
    std::string combinedQuality = calculateCombinedQuality();
    storage->set(combinedQuality, "NETWORK_QUALITY");

    // INTERNET_REACHABLE: The single source of truth for app network operations
    // true = internet is verified reachable, safe to make API calls
    // false = internet is offline or unreachable, queue/skip network operations
    storage->set(_internetReachable, "INTERNET_REACHABLE");

    // INTERNET_STATE: Simple state similar to APP_STATE
    // Values: "offline", "online", "online-weak"
    std::string internetState = "offline";
    if (_internetReachable) {
      // Determine if connection is weak based on quality
      if (_internetQuality == "poor" || _internetQuality == "fair" || combinedQuality == "weak") {
        internetState = "online-weak";
      } else {
        internetState = "online";
      }
    }
    storage->set(internetState, "INTERNET_STATE");

    if (_debugMode) {
      logDebug("Updated internet: state=" + internetState +
               ", reachable=" + std::string(_internetReachable ? "true" : "false") +
               ", quality=" + _internetQuality +
               ", latency=" + std::to_string((int)_lastPingLatencyMs) + "ms");
    }
  }

  /**
   * Calculate combined quality based on network type AND internet quality
   */
  std::string calculateCombinedQuality() {
    // If offline, return offline
    if (_currentNetworkState.status == NetworkStatus::OFFLINE ||
        _currentNetworkState.type == ConnectionType::NONE ||
        _internetQuality == "offline") {
      return "offline";
    }

    // If we don't have internet quality data yet, fall back to network-only assessment
    if (_internetQuality == "unknown" || _lastPingLatencyMs < 0) {
      // Fall back to network-type-based quality
      if (_currentNetworkState.type == ConnectionType::WIFI ||
          _currentNetworkState.type == ConnectionType::ETHERNET) {
        return "strong";
      } else if (_currentNetworkState.type == ConnectionType::CELLULAR) {
        if (_currentNetworkState.cellularGeneration == CellularGeneration::_5G ||
            _currentNetworkState.cellularGeneration == CellularGeneration::_4G) {
          return "strong";
        } else if (_currentNetworkState.cellularGeneration == CellularGeneration::_3G) {
          return "medium";
        } else {
          return "weak";
        }
      }
      return "unknown";
    }

    // Map internet quality to our quality scale
    if (_internetQuality == "excellent") {
      return "strong";
    } else if (_internetQuality == "good") {
      return "strong";
    } else if (_internetQuality == "fair") {
      return "medium";
    } else if (_internetQuality == "poor") {
      return "weak";
    }

    return "unknown";
  }
#endif
};

} // namespace margelo::nitro::sam
