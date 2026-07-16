package com.trickeeandroid

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "TrickeeAndroid"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleQuickActionIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleQuickActionIntent(intent)
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    private fun handleQuickActionIntent(intent: Intent?) {
        val action = intent?.getStringExtra(TrickeeQuickActions.EXTRA_ACTION)
            ?: intent?.action
        if (TrickeeQuickActions.isQuickAction(action)) {
            TrickeeActionModule.dispatchAction(this, action, openApp = false)
        }
    }
}
