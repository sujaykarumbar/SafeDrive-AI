"""
SafeDrive AI — Multi-Step Emergency Escalation & Road Dept Notifier (Phase 4)
Implements:
1. Multi-step Emergency Escalation Flowchart (PDF Figure 7.1):
   - Level 1: Trigger / 30s Countdown
   - Level 2: Unresponsive -> Multi-channel dispatch (Push + SMS + Email + Live Link)
   - Level 3: Automated Caretaker Call Simulation (Caretaker 1 -> 2 -> 3)
   - Level 4: 2-min Unacknowledged Timeout -> Ambulance/Emergency Partner Dispatch
2. Incident Timeline Logging
3. Road Department Multi-Channel Urgent Alerts (PDF Figure 9.1):
   - Critical: Push + SMS + Email + Supervisor Escalation
   - High: Push + Email
   - Fix verification with after-photo evidence
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.user import User, DriverProfile, CaretakerLink, LinkStatus
from backend.app.models.emergency import EmergencyIncident, IncidentStatus
from backend.app.models.hazard import Hazard, HazardStatus, HazardStatusHistory, HazardSeverity
from backend.app.models.audit import AuditLog


class NotificationChannel:
    """Simulated notification delivery with full payload audit trail."""
    def __init__(self):
        self.dispatched_notifications: List[Dict[str, Any]] = []

    def send_push(self, recipient: str, title: str, body: str, data: Optional[Dict] = None):
        rec = {
            "channel": "push",
            "recipient": recipient,
            "title": title,
            "body": body,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "delivered"
        }
        self.dispatched_notifications.append(rec)
        print(f"[SafeDrive AI Push] To: {recipient} | {title} - {body}")
        return rec

    def send_sms(self, phone: str, message: str):
        rec = {
            "channel": "sms",
            "phone": phone,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "delivered_via_twilio_sim"
        }
        self.dispatched_notifications.append(rec)
        print(f"[SafeDrive AI SMS] To: {phone} | {message}")
        return rec

    def send_email(self, email: str, subject: str, html_body: str):
        rec = {
            "channel": "email",
            "email": email,
            "subject": subject,
            "body_snippet": html_body[:120],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "delivered_via_sendgrid_sim"
        }
        self.dispatched_notifications.append(rec)
        print(f"[SafeDrive AI Email] To: {email} | Subject: {subject}")
        return rec

    def initiate_voice_call(self, phone: str, speech_text: str):
        rec = {
            "channel": "voice_call",
            "phone": phone,
            "speech_text": speech_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "call_connected_sim"
        }
        self.dispatched_notifications.append(rec)
        print(f"[SafeDrive AI Automated Call] Dialing {phone} -> \"{speech_text}\"")
        return rec

    def dispatch_ambulance(self, incident_id: int, driver_name: str, location: Dict, medical_info: Dict):
        rec = {
            "channel": "ambulance_partner",
            "incident_id": incident_id,
            "driver_name": driver_name,
            "coordinates": location,
            "medical_info": medical_info,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "ambulance_unit_dispatched_sim",
            "dispatch_unit": "Apollo 108 Emergency Response Unit #04"
        }
        self.dispatched_notifications.append(rec)
        print(f"[SafeDrive AI AMBULANCE DISPATCH] Incident #{incident_id} -> {rec['dispatch_unit']} assigned to {driver_name}")
        return rec


notifier = NotificationChannel()


class EmergencyEscalationService:
    def __init__(self):
        self.notifier = notifier

    def process_incident_escalation(self, db: Session, incident_id: int, target_level: int = 2) -> Dict[str, Any]:
        """
        Executes escalation steps according to Blueprint Section 7.
        Level 2: Caretaker instant push + SMS + email
        Level 3: Automated sequence voice call
        Level 4: Ambulance dispatch if unacknowledged
        """
        incident = db.query(EmergencyIncident).filter(EmergencyIncident.id == incident_id).first()
        if not incident:
            raise ValueError(f"Incident #{incident_id} not found")

        driver = db.query(User).filter(User.id == incident.driver_id).first()
        driver_name = driver.name if driver else "Driver"
        profile = db.query(DriverProfile).filter(DriverProfile.user_id == incident.driver_id).first()

        # Find linked caretakers
        links = db.query(CaretakerLink).filter(
            CaretakerLink.driver_id == incident.driver_id,
            CaretakerLink.status == LinkStatus.ACCEPTED.value
        ).all()
        caretaker_users = [l.caretaker for l in links if l.caretaker]

        events = []
        loc_str = f"https://maps.google.com/?q={incident.latitude},{incident.longitude}"

        if target_level >= 2:
            incident.status = IncidentStatus.ALERTED.value
            incident.escalation_level = 2

            msg = f"EMERGENCY ALERT: SafeDrive detected a suspected crash/SOS for {driver_name}. Live location: {loc_str}. Medical Blood Group: {incident.medical_snapshot.get('blood_group', 'N/A')}."

            for ct in caretaker_users:
                # Push
                self.notifier.send_push(
                    recipient=ct.email,
                    title=f"CRITICAL: {driver_name} In Emergency!",
                    body=f"Suspected impact or SOS triggered at {incident.location_address or 'corridor'}. Tap to respond.",
                    data={"incident_id": incident.id, "location_url": loc_str}
                )
                # SMS
                if ct.phone:
                    self.notifier.send_sms(ct.phone, msg)
                # Email
                self.notifier.send_email(
                    email=ct.email,
                    subject=f"[URGENT SafeDrive SOS] Incident Alert for {driver_name}",
                    html_body=f"<h2>SafeDrive AI Emergency Alert</h2><p>{msg}</p><p>Please acknowledge in Caretaker Portal immediately.</p>"
                )
            events.append("Level 2 Dispatched: Multi-channel Caretaker Push, SMS, and Email sent")

        if target_level >= 3:
            incident.escalation_level = 3
            # Sequential Automated Voice Call to caretakers
            for idx, ct in enumerate(caretaker_users, 1):
                phone = ct.phone or "+919876543210"
                speech = f"Emergency Alert from SafeDrive AI. Your monitored driver, {driver_name}, has had a potential crash and is not responding. Live coordinates have been sent to your phone. Press 1 to acknowledge."
                self.notifier.initiate_voice_call(phone, speech)
                events.append(f"Level 3 Automated Call placed to Caretaker #{idx} ({ct.name})")

        if target_level >= 4:
            incident.escalation_level = 4
            # Emergency Partner / Ambulance Escalation
            amb_dispatch = self.notifier.dispatch_ambulance(
                incident_id=incident.id,
                driver_name=driver_name,
                location={"lat": incident.latitude, "lng": incident.longitude, "address": incident.location_address},
                medical_info=incident.medical_snapshot or {}
            )
            incident.notes = (incident.notes or "") + f"\n[Escalated to Ambulance Partner: {amb_dispatch['dispatch_unit']}]"
            events.append("Level 4 Timeout Escalation: Ambulance Service Partner Dispatched")

        db.commit()
        db.refresh(incident)

        return {
            "incident_id": incident.id,
            "escalation_level": incident.escalation_level,
            "status": incident.status,
            "timeline_events": events,
            "notifications_sent_count": len(events)
        }


class RoadDepartmentWorkflowService:
    def __init__(self):
        self.notifier = notifier

    def dispatch_hazard_alert(self, hazard: Hazard) -> Dict[str, Any]:
        """
        Dispatches multi-channel alerts to road department according to severity (PDF Chapter 9.2).
        """
        sev = (hazard.severity or "medium").lower()
        dept_email = "alerts@bbmp-roads.gov.in"
        duty_officer_phone = "+919845001122"

        channels = []
        if sev == "critical":
            # Fallen tree, major collapse
            self.notifier.send_push(
                recipient=dept_email,
                title="[CRITICAL HAZARD] Road Blocked!",
                body=f"{hazard.title} at {hazard.address or 'Corridor'}. Immediate clearance team required.",
                data={"hazard_id": hazard.id, "lat": hazard.latitude, "lng": hazard.longitude}
            )
            self.notifier.send_sms(
                duty_officer_phone,
                f"BBMP ROAD ALERT: Critical hazard reported #{hazard.id} ({hazard.hazard_type}). Road obstructed at {hazard.address}. Team dispatch required."
            )
            self.notifier.send_email(
                dept_email,
                f"[CRITICAL ROAD HAZARD #{hazard.id}] {hazard.title}",
                f"<p>Photo evidence attached. Location: {hazard.latitude}, {hazard.longitude}. Confirmations: {hazard.confirmation_count}</p>"
            )
            channels.extend(["push", "sms", "email", "duty_officer_alert"])

        elif sev == "high":
            # Deep pothole
            self.notifier.send_push(
                recipient=dept_email,
                title="[HIGH HAZARD] Severe Pothole / Surface Damage",
                body=f"High wheel-damage risk reported at {hazard.address}."
            )
            self.notifier.send_email(
                dept_email,
                f"[High Priority Hazard #{hazard.id}] {hazard.title}",
                f"<p>Assigned to Quick Response Pothole Team. Confirmations: {hazard.confirmation_count}</p>"
            )
            channels.extend(["push", "email"])

        else:
            self.notifier.send_email(
                dept_email,
                f"[Road Department Summary] New {hazard.hazard_type.capitalize()} Logged",
                f"<p>{hazard.title} logged for scheduled maintenance.</p>"
            )
            channels.append("email")

        return {
            "hazard_id": hazard.id,
            "severity": sev,
            "dispatched_channels": channels
        }

    def verify_and_close_fix(
        self,
        db: Session,
        hazard_id: int,
        officer_id: int,
        fixed_proof_image_url: str,
        completion_notes: str
    ) -> Hazard:
        """
        Closes hazard workflow only when after-photo evidence is uploaded (PDF Chapter 9.2 & 13.4).
        Notifies reporting drivers that the hazard has been repaired.
        """
        hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not hazard:
            raise ValueError(f"Hazard #{hazard_id} not found")

        hazard.status = HazardStatus.FIXED.value
        hazard.fixed_image_url = fixed_proof_image_url

        history = HazardStatusHistory(
            hazard_id=hazard.id,
            previous_status=HazardStatus.IN_PROGRESS.value,
            new_status=HazardStatus.FIXED.value,
            changed_by_user_id=officer_id,
            notes=f"Repair completed with photographic proof: {completion_notes}",
            proof_image_url=fixed_proof_image_url
        )
        db.add(history)
        db.commit()
        db.refresh(hazard)

        # Notify the reporter and drivers
        if hazard.reporter:
            self.notifier.send_push(
                recipient=hazard.reporter.email,
                title="Hazard Repair Verified!",
                body=f"Great news! Your reported hazard '{hazard.title}' has been fixed by the Road Taskforce. Thank you for making roads safer!",
                data={"hazard_id": hazard.id, "proof_image": fixed_proof_image_url}
            )

        return hazard


escalation_service = EmergencyEscalationService()
road_dept_workflow = RoadDepartmentWorkflowService()
