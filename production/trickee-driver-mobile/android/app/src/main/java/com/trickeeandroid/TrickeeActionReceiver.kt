package com.trickeeandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TrickeeActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        TrickeeActionModule.dispatchAction(
            context,
            intent?.action ?: intent?.getStringExtra(TrickeeQuickActions.EXTRA_ACTION),
        )
    }
}
