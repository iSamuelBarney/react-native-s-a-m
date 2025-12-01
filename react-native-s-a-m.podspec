require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "react-native-s-a-m"
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = package['repository']['url']
  s.license      = package['license']
  s.authors      = package['author']

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => package['repository']['url'], :tag => "#{s.version}" }

  # Source files
  s.source_files = "cpp/**/*.{h,hpp,c,cpp}"

  # Header files
  s.public_header_files = "cpp/**/*.{h,hpp}"

  # Dependencies
  s.dependency "React-Core"

  # MMKVCore - the C++ core library from Tencent MMKV
  # This allows us to read/write to the same MMKV storage as react-native-mmkv v4
  # react-native-mmkv v4 requires MMKVCore >= 2.2.4
  s.dependency "MMKVCore", ">= 2.2.4"

  # Link SQLite3 (bundled with iOS)
  s.library = "sqlite3"

  # iOS frameworks for network monitoring
  s.frameworks = "Network", "SystemConfiguration", "CoreTelephony"

  # Add Nitrogen generated files
  load 'nitrogen/generated/ios/ReactNativeSAM+autolinking.rb'
  add_nitrogen_files(s)
end
