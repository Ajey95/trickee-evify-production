package com.trickeeandroid

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class TrickeeActionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun startQuickAccessNotification() {
        createChannel(reactContext)
        val manager =
            reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(reactContext))
    }

    @ReactMethod
    fun stopQuickAccessNotification() {
        val manager =
            reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
    }

    @ReactMethod
    fun consumePendingAction(promise: Promise) {
        val prefs = reactContext.getSharedPreferences(TrickeeQuickActions.PREFS, Context.MODE_PRIVATE)
        val action = prefs.getString(TrickeeQuickActions.PENDING_ACTION, null)
        prefs.edit().remove(TrickeeQuickActions.PENDING_ACTION).apply()
        promise.resolve(action)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required by NativeEventEmitter.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required by NativeEventEmitter.
    }

    companion object {
        const val NAME = "TrickeeActionModule"
        private const val CHANNEL_ID = "trickee_quick_actions"
        private const val NOTIFICATION_ID = 1042

        fun dispatchAction(context: Context, rawAction: String?, openApp: Boolean = true) {
            val action = TrickeeQuickActions.normalize(rawAction)
            context.getSharedPreferences(TrickeeQuickActions.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(TrickeeQuickActions.PENDING_ACTION, action)
                .apply()

            val app = context.applicationContext as? ReactApplication
            val reactContext = app?.reactNativeHost?.reactInstanceManager?.currentReactContext
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("quickAction", action)

            if (openApp) {
                openAppForAction(context, action)
            }
        }

        private fun createChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Trickee quick actions",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Persistent driver shortcuts for Trickee."
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)
        }

        private fun buildNotification(context: Context) =
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Trickee active")
                .setContentText("Copilot, SOS, trip, and charging actions are ready.")
                .setContentIntent(openAppIntent(context))
                .setOngoing(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .addAction(
                    R.mipmap.ic_launcher,
                    "SOS",
                    actionActivityIntent(context, TrickeeQuickActions.ACTION_SOS, 1),
                )
                .addAction(
                    R.mipmap.ic_launcher,
                    "Copilot",
                    actionActivityIntent(context, TrickeeQuickActions.ACTION_COPILOT, 2),
                )
                .addAction(
                    R.mipmap.ic_launcher,
                    "Trip",
                    actionActivityIntent(context, TrickeeQuickActions.ACTION_TRIP, 3),
                )
                .addAction(
                    R.mipmap.ic_launcher,
                    "Charging",
                    actionActivityIntent(context, TrickeeQuickActions.ACTION_CHARGING, 4),
                )
                .build()

        private fun actionActivityIntent(context: Context, action: String, requestCode: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                this.action = action
                putExtra(TrickeeQuickActions.EXTRA_ACTION, action)
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun openAppForAction(context: Context, action: String) {
            val intent = Intent(context, MainActivity::class.java).apply {
                this.action = action
                putExtra(TrickeeQuickActions.EXTRA_ACTION, action)
                flags =
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            context.startActivity(intent)
        }

        private fun openAppIntent(context: Context): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            return PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
