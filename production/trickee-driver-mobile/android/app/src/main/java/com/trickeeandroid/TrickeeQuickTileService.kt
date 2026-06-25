package com.trickeeandroid

import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

abstract class TrickeeActionTileService(
    private val quickAction: String,
    private val tileLabel: String,
    private val tileSubtitle: String,
) : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            label = tileLabel
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                subtitle = tileSubtitle
            }
            state = Tile.STATE_ACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        TrickeeActionModule.dispatchAction(this, quickAction)
    }
}

class TrickeeQuickTileService : TrickeeActionTileService(
    TrickeeQuickActions.ACTION_COPILOT,
    "Trickee Copilot",
    "Voice assist",
)

class TrickeeSosTileService : TrickeeActionTileService(
    TrickeeQuickActions.ACTION_SOS,
    "Trickee SOS",
    "Emergency",
)

class TrickeeTripTileService : TrickeeActionTileService(
    TrickeeQuickActions.ACTION_TRIP,
    "Trickee Trip",
    "Start or end",
)

class TrickeeChargingTileService : TrickeeActionTileService(
    TrickeeQuickActions.ACTION_CHARGING,
    "Trickee Charge",
    "Start or end",
)
