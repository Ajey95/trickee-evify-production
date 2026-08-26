import type { Metadata } from "next";
import { InfoList, InfoSection, PublicAppInfoPage } from "@/components/public/GpsDriverInfoPage";

export const metadata: Metadata = {
  title: "VRTrickee Terms of Use | Trickee",
  description: "Terms governing authorized access to and use of the VRTrickee Android application.",
};

export default function VrTrickeeTermsPage() {
  return (
    <PublicAppInfoPage appName="VRTrickee" routePrefix="/vrtrickee" title="VRTrickee Terms of Use" summary="Terms governing VRTrickee access by authorized drivers, fleet personnel, testers, and participating organizations." updated="24 August 2026">
      <InfoSection title="1. Acceptance and eligibility">
        <p>By installing or using VRTrickee, you agree to these terms and the VRTrickee Privacy Policy. You must be authorized by the relevant fleet and satisfy applicable driving, employment, and age requirements.</p>
      </InfoSection>

      <InfoSection title="2. Accounts and assignments">
        <p>Google Sign-In verifies identity, while Trickee or an authorized fleet administrator grants roles and assigns drivers and vehicles. You are responsible for selecting the correct account, protecting your device, and reporting unauthorized use.</p>
        <p>You may not impersonate another person, use another driver&apos;s assignment, share authentication tokens, or obtain access that has not been granted.</p>
      </InfoSection>

      <InfoSection title="3. Permitted use">
        <InfoList>
          <li>Use VRTrickee only for legitimate, authorized fleet and driver operations.</li>
          <li>Provide accurate vehicle, battery, trip, charging, issue, and safety information.</li>
          <li>Use location and voice features only with lawful authority and appropriate notice.</li>
          <li>Follow fleet procedures, road rules, vehicle warnings, and safety instructions.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="4. Safety and service limitations">
        <p>Do not interact with VRTrickee while driving unless a lawful hands-free method is used. Park safely before reviewing or changing trip, charging, SOS, route, or assistant controls.</p>
        <p>GPS, networks, map data, voice recognition, vehicle inputs, and estimates may be delayed, incomplete, or inaccurate. VRTrickee does not guarantee connectivity, route safety, exact range, arrival battery level, or uninterrupted availability. It is not an emergency or collision-avoidance system.</p>
      </InfoSection>

      <InfoSection title="5. Prohibited conduct">
        <InfoList>
          <li>Do not use the service unlawfully, dangerously, fraudulently, or outside an authorized assignment.</li>
          <li>Do not fabricate location, vehicle, order, trip, charging, safety, or voice inputs.</li>
          <li>Do not bypass, probe, reverse engineer, overload, or interfere with authentication, access controls, telemetry integrity, or infrastructure except where law expressly permits.</li>
          <li>Do not use VRTrickee to track a person or vehicle without appropriate authority and lawful purpose.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="6. Ownership, suspension, and contact">
        <p>Trickee and its licensors retain their rights in the application, service, branding, software, models, documentation, and platform technology. You receive a limited, revocable, non-exclusive, non-transferable right to use VRTrickee for authorized operations.</p>
        <p>Trickee or a fleet administrator may suspend access when an assignment ends, these terms are violated, continued access creates safety or security risk, or suspension is required by law or contract. Questions: <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:support@trickee.co.in">support@trickee.co.in</a>.</p>
      </InfoSection>
    </PublicAppInfoPage>
  );
}
