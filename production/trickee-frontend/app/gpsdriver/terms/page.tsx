import type { Metadata } from "next";
import { GpsDriverInfoPage, InfoList, InfoSection } from "@/components/public/GpsDriverInfoPage";

export const metadata: Metadata = {
  title: "GPS Driver Terms of Use | Trickee",
  description: "Terms governing authorized access to and use of the Trickee GPS Driver application.",
};

export default function GpsDriverTermsPage() {
  return (
    <GpsDriverInfoPage
      title="GPS Driver Terms of Use"
      summary="These terms govern access to Trickee GPS Driver by authorized drivers, fleet personnel, testers, and participating organizations."
      updated="11 August 2026"
    >
      <InfoSection title="1. Acceptance and eligibility">
        <p>
          By installing, accessing, or using GPS Driver, you agree to these terms and the GPS Driver Privacy Policy. You must be legally permitted to drive the applicable vehicle, satisfy the age and employment requirements that apply to you, and be authorized by the relevant fleet organization.
        </p>
        <p>If you do not agree, do not use GPS Driver.</p>
      </InfoSection>

      <InfoSection title="2. Accounts and access">
        <p>
          Google Sign-In confirms identity but does not by itself grant fleet access. Trickee or an authorized fleet administrator assigns drivers, vehicles, and roles. You are responsible for using the correct Google account, protecting access to your device, and promptly reporting unauthorized use.
        </p>
        <p>
          You may not impersonate another driver, use another person&apos;s assignment, share authentication tokens, or attempt to obtain admin or fleet access that has not been granted to you.
        </p>
      </InfoSection>

      <InfoSection title="3. Permitted operational use">
        <p>
          GPS Driver may collect trip location and motion telemetry, queue records during connectivity loss, synchronize data with Trickee services, and provide operational estimates or fleet updates. You authorize this processing when you start a trip and use the service as described in the Privacy Policy.
        </p>
        <InfoList>
          <li>Use the application only for an assigned vehicle and legitimate fleet activity.</li>
          <li>Enter vehicle or battery information accurately to the best of your knowledge.</li>
          <li>Keep required Android permissions enabled during an active trip.</li>
          <li>End the trip when authorized collection is no longer required.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="4. Safe use and telemetry limitations">
        <p>
          Do not interact with GPS Driver while driving unless permitted by law and performed through a safe hands-free method. Park safely before starting, reviewing, troubleshooting, or ending a trip.
        </p>
        <p>
          GPS, sensors, mobile networks, map data, battery inputs, and derived estimates can be delayed, incomplete, or inaccurate. GPS Driver does not guarantee an exact sampling interval, uninterrupted connectivity, battery range, arrival state of charge, route safety, or availability. It is not an emergency, collision-avoidance, or legally certified navigation system.
        </p>
      </InfoSection>

      <InfoSection title="5. Prohibited use">
        <InfoList>
          <li>Do not use the service unlawfully, dangerously, fraudulently, or outside an authorized fleet assignment.</li>
          <li>Do not disable, bypass, probe, reverse engineer, overload, or interfere with authentication, access controls, telemetry integrity, or service infrastructure except where applicable law expressly permits.</li>
          <li>Do not submit fabricated locations, sensor values, vehicle information, or another person&apos;s personal data.</li>
          <li>Do not use GPS Driver to track a person or vehicle without appropriate notice, authority, and lawful purpose.</li>
          <li>Do not copy, sell, sublicense, or commercially exploit the application except under a written agreement with Trickee.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="6. Application and service ownership">
        <p>
          Trickee and its licensors retain their rights in the application, service, branding, software, models, documentation, and derived platform technology. Subject to these terms, you receive a limited, revocable, non-exclusive, non-transferable right to use GPS Driver for authorized fleet operations.
        </p>
        <p>
          Rights in fleet-provided data and operational outputs may also be governed by the agreement between Trickee and the participating fleet organization.
        </p>
      </InfoSection>

      <InfoSection title="7. Third-party and platform services">
        <p>
          GPS Driver depends on Android, Google Sign-In, Google Play services, cloud infrastructure, maps, network providers, and device manufacturers. Their terms and availability may also apply. Trickee is not responsible for a third-party service outside its reasonable control.
        </p>
      </InfoSection>

      <InfoSection title="8. Suspension and termination">
        <p>
          Trickee or an authorized fleet administrator may suspend or end access when an assignment ends, a user violates these terms, continued access creates security or safety risk, or suspension is required by law or contract. You may stop using the service and request account deactivation through your fleet administrator or Trickee support.
        </p>
      </InfoSection>

      <InfoSection title="9. Service changes and responsibility">
        <p>
          Features may change as GPS Driver is tested and improved. To the extent permitted by applicable law, the service is provided without a promise that it will always be available or error-free. Nothing in these terms excludes rights or responsibilities that cannot lawfully be excluded.
        </p>
        <p>
          Fleet organizations remain responsible for vehicle safety, driver supervision, legal compliance, and operational decisions. Drivers remain responsible for road safety and compliance with vehicle and traffic requirements.
        </p>
      </InfoSection>

      <InfoSection title="10. Changes and contact">
        <p>
          We may update these terms to reflect changes in the service, law, or fleet operations. The revised date appears at the top of this page. Continued use after an applicable update means the updated terms govern future use, subject to mandatory legal rights.
        </p>
        <p>
          Questions about these terms: <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:support@trickee.co.in">support@trickee.co.in</a>
        </p>
      </InfoSection>
    </GpsDriverInfoPage>
  );
}
