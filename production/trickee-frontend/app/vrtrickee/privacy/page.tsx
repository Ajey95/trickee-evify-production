import type { Metadata } from "next";
import { InfoList, InfoSection, PublicAppInfoPage } from "@/components/public/GpsDriverInfoPage";

export const metadata: Metadata = {
  title: "VRTrickee Privacy Policy | Trickee",
  description: "How VRTrickee processes driver identity, location, voice input, vehicle, trip, and operational data.",
};

export default function VrTrickeePrivacyPage() {
  return (
    <PublicAppInfoPage appName="VRTrickee" routePrefix="/vrtrickee" title="VRTrickee Privacy Policy" summary="How the VRTrickee Android application handles driver identity, location, voice input, vehicle, trip, and operational information." updated="25 August 2026">
      <InfoSection title="1. Scope and access">
        <p>This policy applies to the public VRTrickee Android application, package <strong className="text-white/82">com.trickee.vrtrickee</strong>, and the Trickee services used to authenticate drivers, show fleet data, receive driver actions, process optional voice input, and provide trip and vehicle guidance.</p>
        <p>Google Sign-In verifies identity. Fleet, vehicle, and role access is granted separately by Trickee or an authorized fleet administrator.</p>
      </InfoSection>

      <InfoSection title="2. Data we process">
        <InfoList>
          <li><strong className="text-white/82">Account data:</strong> name, email address, Google account identifier, authentication status, role, and session identifiers.</li>
          <li><strong className="text-white/82">Fleet and vehicle data:</strong> fleet, driver, vehicle, order and trip identifiers; assignments; vehicle status; battery state; and operational alerts.</li>
          <li><strong className="text-white/82">Foreground location:</strong> latitude and longitude, accuracy, speed, timestamp, and trip context while the app is open and location permission is granted.</li>
          <li><strong className="text-white/82">Voice input:</strong> a short audio clip recorded only after the driver taps the voice control and grants microphone permission. It is sent to Trickee for transcription and assistant processing.</li>
          <li><strong className="text-white/82">Driver actions:</strong> trip, charging, waiting, SOS, issue-report, assistant-message, and alert acknowledgement events.</li>
          <li><strong className="text-white/82">Technical data:</strong> app and operating-system version, network and request metadata, error details, and security logs.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="3. Permission behavior">
        <p>VRTrickee requests foreground location for live driver and trip features, microphone access only when voice input is used, and notification access for quick actions and alerts. The current Play build does not request background-location access.</p>
        <p>You can deny or revoke an optional permission in Android settings. The related feature will be unavailable or less accurate.</p>
      </InfoSection>

      <InfoSection title="4. Why we use data">
        <InfoList>
          <li>Authenticate users and enforce fleet, driver, vehicle, and role access.</li>
          <li>Show live vehicle, order, trip, charging, route, battery, and safety information.</li>
          <li>Record authorized driver actions and location-assisted operational events.</li>
          <li>Transcribe optional voice input and generate relevant assistant responses.</li>
          <li>Secure the service, troubleshoot failures, prevent misuse, and meet legal or contractual duties.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="5. Sharing and advertising">
        <p>Authorized fleet personnel may see information associated with their drivers, vehicles, orders, and trips. Authentication, transcription, hosting, database, monitoring, and delivery providers may process data on our behalf under their applicable safeguards.</p>
        <p>VRTrickee does not contain third-party advertising and does not sell driver location, voice, account, vehicle, or trip data for advertising.</p>
      </InfoSection>

      <InfoSection title="6. Storage, retention, and security">
        <p>Data is transmitted over encrypted connections. Authentication tokens are stored using Android-protected application credentials. Operational records are retained only as needed for fleet operations, safety, support, security, contracts, backups, and legal obligations. Voice clips are submitted for the requested transcription workflow and are not intended to become a reusable voice profile.</p>
        <p>We use access controls, authenticated APIs, scoped infrastructure access, encrypted transport, and operational monitoring. No system can be guaranteed completely secure.</p>
      </InfoSection>

      <InfoSection title="7. Choices and contact">
        <InfoList>
          <li>Revoke location, microphone, or notification access in Android settings.</li>
          <li>Sign out to remove the active application session from the device.</li>
          <li>Ask your fleet administrator to correct an assignment or operational record.</li>
          <li>Request access, correction, deactivation, or deletion, subject to lawful retention requirements.</li>
        </InfoList>
        <p>VRTrickee is intended for authorized adult drivers and fleet personnel and is not directed to children.</p>
        <p>Privacy requests: <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:privacy@trickee.co.in">privacy@trickee.co.in</a>. Support: <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:support@trickee.co.in">support@trickee.co.in</a>.</p>
      </InfoSection>
    </PublicAppInfoPage>
  );
}
