import type { Metadata } from "next";
import { GpsDriverInfoPage, InfoList, InfoSection } from "@/components/public/GpsDriverInfoPage";

export const metadata: Metadata = {
  title: "GPS Driver Privacy Policy | Trickee",
  description: "How Trickee GPS Driver collects, uses, protects, and manages driver and vehicle telemetry.",
};

export default function GpsDriverPrivacyPage() {
  return (
    <GpsDriverInfoPage
      title="GPS Driver Privacy Policy"
      summary="This policy explains how Trickee GPS Driver handles account, location, vehicle, trip, and device telemetry when an authorized driver uses the application."
      updated="11 August 2026"
    >
      <InfoSection title="1. Who this policy covers">
        <p>
          This policy applies to the Trickee GPS Driver Android application and the services used to authenticate drivers, receive trip telemetry, synchronize offline records, and provide fleet updates. “Trickee,” “we,” and “our” refer to the Trickee product and operations team responsible for these services.
        </p>
        <p>
          A driver may use Google Sign-In, but access to a fleet or vehicle is granted separately by Trickee or the driver&apos;s fleet organization.
        </p>
      </InfoSection>

      <InfoSection title="2. Data we process">
        <InfoList>
          <li><strong className="text-white/82">Account information:</strong> name, email address, Google account identifier, authentication status, and assigned application role.</li>
          <li><strong className="text-white/82">Fleet and vehicle information:</strong> fleet, driver and vehicle identifiers, vehicle specifications, assignment status, and driver-entered state-of-charge information.</li>
          <li><strong className="text-white/82">Location and motion telemetry:</strong> latitude, longitude, accuracy, speed, bearing, altitude when available, GPS availability, timestamps, and accelerometer or gyroscope summaries during an active trip.</li>
          <li><strong className="text-white/82">Trip information:</strong> trip start and end events, route progression, distance, duration, connectivity gaps, safety events, synchronization state, and estimates derived from trip telemetry.</li>
          <li><strong className="text-white/82">Device and service information:</strong> app version, operating-system information, device or session identifiers, notification state, request metadata, and technical diagnostics needed to secure and operate the service.</li>
        </InfoList>
        <p>
          The GPS Driver telemetry pipeline does not require raw microphone recordings. Android permission prompts and any future voice feature will be described in the application before activation.
        </p>
      </InfoSection>

      <InfoSection title="3. When location is collected">
        <p>
          Location and motion collection begins after an authorized driver starts a trip and grants the required Android permissions. Android displays a persistent foreground-service notification while trip collection is active. Collection stops when the driver ends the trip or stops the foreground service.
        </p>
        <p>
          Mobile networks and GPS signals are not continuously available. When connectivity is lost, records may be stored securely on the device and synchronized after connectivity returns. The service records GPS-unavailable periods instead of inventing or repeating coordinates.
        </p>
      </InfoSection>

      <InfoSection title="4. Why we use data">
        <InfoList>
          <li>Authenticate authorized users and enforce fleet, driver, and vehicle access.</li>
          <li>Record trips and provide live or delayed fleet visibility.</li>
          <li>Calculate route, range, energy, driving, and operational insights.</li>
          <li>Recover telemetry after temporary network interruption.</li>
          <li>Investigate errors, abuse, security incidents, and data-quality problems.</li>
          <li>Meet contractual, safety, legal, and compliance responsibilities that apply to the service.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="5. How data is disclosed">
        <p>
          Driver and trip information may be visible to authorized members of the driver&apos;s assigned fleet. We also use infrastructure and identity providers, including Google services, to operate authentication, hosting, databases, storage, monitoring, and delivery. These providers process information on our behalf under their applicable service terms and safeguards.
        </p>
        <p>
          We may disclose information when required by law, to protect users or the service, to investigate misuse, or as part of a legitimate organizational transaction with appropriate protections. GPS Driver trip telemetry is not used for third-party advertising.
        </p>
      </InfoSection>

      <InfoSection title="6. Storage and retention">
        <p>
          Telemetry is transmitted over encrypted connections and may be queued in protected application storage before upload. The current operational target is to retain raw GPS samples for up to 90 days. Trip summaries, assignments, derived operational records, security logs, backups, and archives may be retained longer when needed for fleet operations, contractual records, safety review, dispute resolution, or legal obligations.
        </p>
        <p>
          Retention settings may vary by fleet agreement. When information is no longer required, it is deleted, anonymized, or isolated from ordinary use according to operational and backup schedules.
        </p>
      </InfoSection>

      <InfoSection title="7. Security">
        <p>
          We use access controls, scoped service identities, encrypted transport, authenticated APIs, restricted infrastructure access, and operational monitoring. No system can be guaranteed completely secure, so drivers should report suspected account or device compromise promptly.
        </p>
      </InfoSection>

      <InfoSection title="8. Your choices and requests">
        <InfoList>
          <li>You can deny or revoke Android location and notification permissions, although active-trip features may then stop working.</li>
          <li>You can end a trip to stop its foreground location collection.</li>
          <li>You can request access, correction, deactivation, or deletion by contacting your fleet administrator or Trickee.</li>
          <li>Some records may be retained when required for security, contractual, legal, or legitimate fleet-operation purposes.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="9. Children">
        <p>
          GPS Driver is an operational fleet application intended for authorized adult drivers and fleet personnel. It is not directed to children, and users must meet the driving, employment, and age requirements that apply in their jurisdiction.
        </p>
      </InfoSection>

      <InfoSection title="10. Changes and contact">
        <p>
          We may update this policy when the application, infrastructure, or legal requirements change. The revised date will be shown at the top of this page. Material changes may also be communicated through the application or fleet administrator.
        </p>
        <p>
          Privacy requests: <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:privacy@trickee.co.in">privacy@trickee.co.in</a><br />
          General support: <a className="font-medium text-[#8af7d1] underline decoration-[#8af7d1]/35 underline-offset-4 hover:text-white" href="mailto:support@trickee.co.in">support@trickee.co.in</a>
        </p>
      </InfoSection>
    </GpsDriverInfoPage>
  );
}
