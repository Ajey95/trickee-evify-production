import {create} from 'zustand';

import type {
  MobileChargingSession,
  MobileMe,
  MobileState,
  MobileTripSession,
  MobileWaitEvent,
} from '../types';

type DriverStore = {
  state: MobileState;
  me?: MobileMe;
  activeTrip?: MobileTripSession | null;
  activeCharging?: MobileChargingSession | null;
  activeWaiting?: MobileWaitEvent | null;
  latestMessage?: string;
  setState: (state: MobileState) => void;
  setMe: (me: MobileMe) => void;
  setTrip: (trip?: MobileTripSession | null) => void;
  setCharging: (session?: MobileChargingSession | null) => void;
  setWaiting: (event?: MobileWaitEvent | null) => void;
  setMessage: (message?: string) => void;
};

export const useDriverStore = create<DriverStore>(set => ({
  state: 'ready',
  setState: state => set({state}),
  setMe: me =>
    set({
      me,
      activeTrip: me.active_trip,
      activeCharging: me.active_charging,
      activeWaiting: me.active_waiting,
      state: me.active_charging ? 'charging' : me.active_waiting ? 'waiting' : me.active_trip ? 'trip_active' : 'ready',
    }),
  setTrip: activeTrip => set({activeTrip, state: activeTrip ? 'trip_active' : 'ready'}),
  setCharging: activeCharging => set({activeCharging, state: activeCharging ? 'charging' : 'trip_active'}),
  setWaiting: activeWaiting => set({activeWaiting, state: activeWaiting ? 'waiting' : 'trip_active'}),
  setMessage: latestMessage => set({latestMessage}),
}));
