import type { Metadata } from "next";
import { InfoList, InfoSection, PublicAppInfoPage } from "@/components/public/GpsDriverInfoPage";

export const metadata: Metadata = {
  title: "VRTrickee Support | Trickee",
  description: "Sign-in, location, voice assistant, vehicle assignment, and operational support for VRTrickee.",
};

export default function VrTrickeeSupportPage() {
  return (
    <PublicAppInfoPage appName="VRTrickee" routePrefix="/vrtrickee" title="VRTrickee Support" summary="Help with Google Sign-In, fleet access, location, voice input, vehicle assignments, trips, charging, SOS, and live operational updates." updated="25 August 2026">
      <InfoSection title="Before signing in">
        <InfoList>
          <li>Install VRTrickee from its official Google Play listing.</li>
          <li>Use an Android device with current Google Play services.</li>
          <li>Sign in with the exact Google email address provisioned by your fleet administrator.</li>
          <li>Confirm that the assigned driver and vehicle details are correct before starting work.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Google Sign-In and access">
        <p>Google authentication confirms identity; it does not automatically create fleet access. If sign-in succeeds but access is denied, ask the fleet administrator to provision the same email and assign a driver and vehicle.</p>
        <p>Never send Trickee your Google password, verification code, recovery code, or application session token.</p>
      </InfoSection>

      <InfoSection title="Permissions">
        <InfoList>
          <li><strong className="text-white/82">Location:</strong> allow precise location while using the app for live position and location-assisted actions. The current release does not request background location.</li>
          <li><strong className="text-white/82">Microphone:</strong> allow it only to record a short voice request for the copilot.</li>
          <li><strong className="text-white/82">Notifications:</strong> allow notifications for quick actions and operational alerts.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Common fixes">
        <InfoList>
          <li><strong className="text-white/82">Wrong vehicle:</strong> do not begin the trip; request an assignment correction.</li>
          <li><strong className="text-white/82">Location missing:</strong> enable device location, grant precise permission, move to an open area, and reopen the app.</li>
          <li><strong className="text-white/82">Voice input fails:</strong> grant microphone permission, confirm network access, and retry a short request.</li>
          <li><strong className="text-white/82">Live data is stale:</strong> confirm mobile data or Wi-Fi, then refresh or reopen the app.</li>
          <li><strong className="text-white/82">Google developer error:</strong> update VRTrickee from Google Play and retry using the provisioned account.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Safety and support">
        <p>Park safely before operating the app. Do not hold or interact with the phone while driving. VRTrickee provides operational estimates and alerts; it is not an emergency, collision-avoidance, or legally certified navigation service.</p>
        <p>Email <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:support@trickee.co.in">support@trickee.co.in</a> with the provisioned email, fleet, vehicle code, phone model, Android version, app version, approximate time, and a screenshot that does not expose credentials.</p>
      </InfoSection>

      <InfoSection title="Request account and data deletion">
        <InfoList>
          <li>Email <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:privacy@trickee.co.in?subject=VRTrickee%20account%20deletion%20request">privacy@trickee.co.in</a> from the Google email used with VRTrickee.</li>
          <li>Use the subject <strong className="text-white/82">VRTrickee account deletion request</strong> and include the associated fleet or vehicle code if known.</li>
          <li>We may verify that the requester controls the account, but we will never ask for a Google password, verification code, recovery code, or application session token.</li>
        </InfoList>
        <p>After verification, Trickee will deactivate the VRTrickee account and delete or anonymize the account profile, active sessions, and personal data that is not required for an ongoing fleet, security, contractual, or legal purpose. The request can also ask for deletion of specific optional data without closing the account.</p>
        <p>Fleet assignments, trip and safety records, fraud-prevention logs, legal records, and protected backups may be retained only for the period required by an applicable fleet contract, security need, backup cycle, or law. We will explain any data that must be retained when responding to the request.</p>
      </InfoSection>
    </PublicAppInfoPage>
  );
}
