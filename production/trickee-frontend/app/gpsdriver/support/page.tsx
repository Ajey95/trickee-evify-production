import type { Metadata } from "next";
import { GpsDriverInfoPage, InfoList, InfoSection } from "@/components/public/GpsDriverInfoPage";

export const metadata: Metadata = {
  title: "GPS Driver Support | Trickee",
  description: "Setup, sign-in, trip tracking, synchronization, and safety help for Trickee GPS Driver.",
};

export default function GpsDriverSupportPage() {
  return (
    <GpsDriverInfoPage
      title="GPS Driver Support"
      summary="Practical help for installing the app, signing in, starting a trip, keeping telemetry active, and recovering from GPS or network interruptions."
      updated="11 August 2026"
    >
      <InfoSection title="Before your first trip">
        <InfoList>
          <li>Use an Android device running Android 7.0 or newer with Google Play services available.</li>
          <li>Install GPS Driver from the official Google Play listing or a test link supplied by Trickee.</li>
          <li>Sign in with the exact Google email address registered by your fleet administrator.</li>
          <li>Confirm that the assigned vehicle shown in the app is the vehicle you will drive.</li>
          <li>Allow precise location and notifications when Android asks.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Google Sign-In help">
        <p>
          If Google authentication succeeds but GPS Driver says that you are not provisioned, your Google email has not yet been assigned to a fleet and vehicle. Contact your fleet administrator or Trickee support and include the exact email shown in Google Sign-In.
        </p>
        <p>
          If Android reports a developer or credential error, update the app from Google Play and try again. Do not share Google passwords, verification codes, or recovery codes with Trickee support.
        </p>
      </InfoSection>

      <InfoSection title="Location and notification permissions">
        <p>
          GPS Driver uses precise location during a driver-started trip. A persistent Android notification identifies the active foreground service. If location is denied, set to approximate only, or disabled at the device level, trip accuracy and live updates may be reduced or unavailable.
        </p>
        <InfoList>
          <li>Open Android Settings → Apps → Trickee GPS Driver → Permissions.</li>
          <li>Allow precise location while using the app.</li>
          <li>Allow notifications so Android can display the active-trip service.</li>
          <li>Exclude GPS Driver from aggressive battery restrictions if your device manufacturer stops the service during long trips.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Starting and ending a trip">
        <InfoList>
          <li>Park safely before interacting with the application.</li>
          <li>Open GPS Driver and verify your vehicle assignment and starting state of charge.</li>
          <li>Tap Start Trip and confirm that the active-trip notification appears.</li>
          <li>Keep location services enabled for the duration of the trip.</li>
          <li>At the destination, park safely, reopen the app, and end the trip.</li>
        </InfoList>
        <p>
          GPS frequency can vary because of device hardware, satellite visibility, Android power management, and environmental conditions. The app records signal gaps rather than generating false positions.
        </p>
      </InfoSection>

      <InfoSection title="Offline and delayed synchronization">
        <p>
          Temporary loss of mobile data does not necessarily mean the trip is lost. GPS Driver queues eligible telemetry on the device and attempts to upload it after connectivity returns. Keep the app installed and do not clear its storage while a trip has unsynchronized records.
        </p>
        <InfoList>
          <li>Restore mobile data or Wi-Fi.</li>
          <li>Open GPS Driver and leave it connected for several minutes.</li>
          <li>Confirm the trip status changes from pending or syncing.</li>
          <li>If synchronization remains stuck, record the trip time, vehicle code, phone model, and error shown before contacting support.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Troubleshooting checklist">
        <InfoList>
          <li><strong className="text-white/82">No GPS:</strong> move to an open area, enable device location, and confirm precise-location permission.</li>
          <li><strong className="text-white/82">Trip stopped:</strong> check the persistent notification and remove restrictive battery optimization for the app.</li>
          <li><strong className="text-white/82">No live update:</strong> verify internet access; queued records should synchronize after reconnection.</li>
          <li><strong className="text-white/82">Wrong vehicle:</strong> do not start the trip; ask the fleet administrator to correct the assignment.</li>
          <li><strong className="text-white/82">Sign-in rejected:</strong> confirm that the selected Google email exactly matches the provisioned driver email.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Safety">
        <p>
          Do not hold or operate the phone while driving. Start, review, or end a trip only when legally parked or when a passenger is operating the device. GPS Driver provides operational estimates and is not an emergency, navigation-safety, or collision-avoidance service. Follow road rules, vehicle warnings, and official emergency guidance.
        </p>
      </InfoSection>

      <InfoSection title="Contact support">
        <p>
          Email <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:support@trickee.co.in">support@trickee.co.in</a> with your Google email, fleet name, vehicle code, trip date and approximate time, phone model, Android version, app version, and a screenshot of the error. Never include your Google password or verification code.
        </p>
        <p>
          For privacy or deletion requests, email <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:privacy@trickee.co.in">privacy@trickee.co.in</a>.
        </p>
      </InfoSection>
    </GpsDriverInfoPage>
  );
}
