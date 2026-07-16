package com.trickeeandroid

object TrickeeQuickActions {
    const val ACTION_SOS = "trickee.quick.SOS"
    const val ACTION_COPILOT = "trickee.quick.COPILOT"
    const val ACTION_TRIP = "trickee.quick.TRIP"
    const val ACTION_CHARGING = "trickee.quick.CHARGING"

    const val EXTRA_ACTION = "action"
    const val PREFS = "trickee.quick.actions"
    const val PENDING_ACTION = "pending_action"

    fun isQuickAction(action: String?): Boolean =
        action == ACTION_SOS ||
            action == ACTION_COPILOT ||
            action == ACTION_TRIP ||
            action == ACTION_CHARGING ||
            action == "sos" ||
            action == "copilot" ||
            action == "trip" ||
            action == "charging"

    fun normalize(action: String?): String =
        when (action) {
            ACTION_SOS, "sos" -> "sos"
            ACTION_COPILOT, "copilot" -> "copilot"
            ACTION_TRIP, "trip" -> "trip"
            ACTION_CHARGING, "charging" -> "charging"
            else -> "copilot"
        }
}
