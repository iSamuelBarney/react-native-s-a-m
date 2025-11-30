cmake_minimum_required(VERSION 3.9.0)

project(ReactNativeSAM)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

# Add NitroModules
find_package(NitroModules REQUIRED CONFIG)

# Find MMKV prefab package (from io.github.zhongwuzw:mmkv dependency)
find_package(mmkv REQUIRED CONFIG)

# Find Android log library
find_library(LOG_LIB log)

# Add the library
add_library(
  ReactNativeSAM
  SHARED
  cpp-adapter.cpp
)

# Include directories
target_include_directories(
  ReactNativeSAM
  PRIVATE
  "../cpp"
  "../nitrogen"
  "../nitrogen/generated"
)

# Link NitroModules, MMKV, and Android libraries
target_link_libraries(
  ReactNativeSAM
  NitroModules::NitroModules
  mmkv::mmkv
  android
  ${LOG_LIB}
)
