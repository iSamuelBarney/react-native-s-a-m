package com.margelo.nitro.sam

import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.core.HybridObjectRegistry

class ReactNativeSAM(reactContext: ReactApplicationContext) {
  companion object {
    const val NAME = "ReactNativeSAM"

    init {
      System.loadLibrary("ReactNativeSAM")
    }
  }

  fun installLibrary(registry: HybridObjectRegistry) {
    // Register the SideFx HybridObject
    registry.registerHybridObjectConstructor("SideFx") {
      createSideFx()
    }
  }

  // Native method declarations
  private external fun createSideFx(): Any
}
