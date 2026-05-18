import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Fleet(Base):
    __tablename__ = "fleets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    users: Mapped[list["User"]] = relationship(back_populates="fleet")
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="fleet")
    drivers: Mapped[list["Driver"]] = relationship(back_populates="fleet")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    supabase_user_id: Mapped[str | None] = mapped_column(String(128), unique=True, index=True, nullable=True)
    firebase_uid: Mapped[str | None] = mapped_column(String(128), unique=True, index=True, nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="password")
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    fleet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fleets.id"), nullable=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    fleet: Mapped[Fleet | None] = relationship(back_populates="users")
    driver: Mapped["Driver | None"] = relationship(back_populates="user")
    push_tokens: Mapped[list["DevicePushToken"]] = relationship(back_populates="user")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    supabase_user_id: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Pending user")
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    requested_role: Mapped[str] = mapped_column(String(50), nullable=False, default="fleet_operator")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
    reviewed_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    review_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class DevicePushToken(Base):
    __tablename__ = "device_push_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, default="web")
    device_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="push_tokens")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AIInteractionLog(Base):
    __tablename__ = "ai_interaction_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=True, index=True)
    fleet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fleets.id"), nullable=True, index=True)
    feature: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    prompt_version: Mapped[str] = mapped_column(String(40), nullable=False, default="v1")
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tool_calls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    token_usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    error_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ToolCallLog(Base):
    __tablename__ = "tool_call_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=True, index=True)
    fleet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fleets.id"), nullable=True, index=True)
    feature: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    tool_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    input_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class NotificationPersonalizationLog(Base):
    __tablename__ = "notification_personalization_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=True, index=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    tone: Mapped[str] = mapped_column(String(30), nullable=False)
    send: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    raw_data_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=True, index=True)
    channel: Mapped[str] = mapped_column(String(30), nullable=False, default="app")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    tool_calls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    escalated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class DriverProfileSnapshot(Base):
    __tablename__ = "driver_profile_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    driver_id: Mapped[str] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    profile: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="rolling_metrics")
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class DriverCoachingEvent(Base):
    __tablename__ = "driver_coaching_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    driver_id: Mapped[str] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=True, index=True)
    trip_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("trips.id"), nullable=True, index=True)
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="trip")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tips: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tone: Mapped[str] = mapped_column(String(30), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class FleetSummaryLog(Base):
    __tablename__ = "fleet_summary_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    fleet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fleets.id"), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    summary_type: Mapped[str] = mapped_column(String(30), nullable=False, default="realtime")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    risks: Mapped[list | None] = mapped_column(JSON, nullable=True)
    suggested_actions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    vehicles_flagged: Mapped[list | None] = mapped_column(JSON, nullable=True)
    fallback_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    fleet_id: Mapped[str] = mapped_column(String(36), ForeignKey("fleets.id"), nullable=False)
    vehicle_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    make: Mapped[str] = mapped_column(String(100), nullable=False, default="Evify")
    model: Mapped[str] = mapped_column(String(100), nullable=False, default="S1 Pro")
    battery_capacity_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=1.824)
    max_range_km: Mapped[float] = mapped_column(Float, nullable=False, default=85.0)
    battery_chemistry: Mapped[str] = mapped_column(String(20), nullable=False, default="LFP")
    manufacture_year: Mapped[int] = mapped_column(Integer, nullable=False, default=2024)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    fleet: Mapped[Fleet] = relationship(back_populates="vehicles")
    telemetry: Mapped[list["Telemetry"]] = relationship(back_populates="vehicle")
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="vehicle")


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    fleet_id: Mapped[str] = mapped_column(String(36), ForeignKey("fleets.id"), nullable=False)
    driver_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    style_label: Mapped[str] = mapped_column(String(50), default="Moderate")
    personal_factor: Mapped[float] = mapped_column(Float, default=1.10)
    avg_regen_ratio: Mapped[float] = mapped_column(Float, default=0.30)
    avg_throttle_variance: Mapped[float] = mapped_column(Float, default=0.20)
    avg_current_30m: Mapped[float] = mapped_column(Float, default=5.0)
    avg_speed_30m: Mapped[float] = mapped_column(Float, default=28.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    fleet: Mapped[Fleet] = relationship(back_populates="drivers")
    user: Mapped[User | None] = relationship(back_populates="driver")
    telemetry: Mapped[list["Telemetry"]] = relationship(back_populates="driver")
    behavior_snapshots: Mapped[list["DriverBehaviorSnapshot"]] = relationship(back_populates="driver")


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    soc: Mapped[float] = mapped_column(Float, nullable=False)
    current: Mapped[float] = mapped_column(Float, nullable=False)
    battery_voltage: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[float] = mapped_column(Float, nullable=False)
    temp_max: Mapped[float] = mapped_column(Float, nullable=False)
    soh: Mapped[float] = mapped_column(Float, nullable=False)
    charge_plug: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ignition_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    regen_status: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    throttle_status: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cycle_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cell_imbalance_mv: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    wh_throughput: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    power: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    power_density: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    temp_rise_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    voltage_sag_v: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    r_internal_mohm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    minute_of_day: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle: Mapped[Vehicle] = relationship(back_populates="telemetry")
    driver: Mapped[Driver | None] = relationship(back_populates="telemetry")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True)
    predicted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    actual_soc: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_delta_soc: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_next_soc: Mapped[float] = mapped_column(Float, nullable=False)
    true_next_soc: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_error: Mapped[float | None] = mapped_column(Float, nullable=True)
    dynamic_range_km: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_range_km: Mapped[float] = mapped_column(Float, nullable=False)
    soh_factor: Mapped[float] = mapped_column(Float, nullable=False)
    thermal_factor: Mapped[float] = mapped_column(Float, nullable=False)
    aggression_factor: Mapped[float] = mapped_column(Float, nullable=False)
    window_size: Mapped[int] = mapped_column(Integer, nullable=False)

    vehicle: Mapped[Vehicle] = relationship(back_populates="predictions")


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    driver_id: Mapped[str] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    origin_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    origin_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    dest_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    dest_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    origin_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dest_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    soc_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    soc_end: Mapped[float | None] = mapped_column(Float, nullable=True)
    kwh_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    route_taken: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recommended_route: Mapped[str | None] = mapped_column(String(50), nullable=True)
    followed_nudge: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DriverBehaviorSnapshot(Base):
    __tablename__ = "driver_behavior_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    driver_id: Mapped[str] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=False, index=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_current_30m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_speed_30m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    regen_ratio_30m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    throttle_var_30m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    style_label: Mapped[str] = mapped_column(String(50), nullable=False, default="Moderate")
    archetype_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    archetype_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    archetype_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    archetype_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    driver: Mapped[Driver] = relationship(back_populates="behavior_snapshots")


class NudgeEvent(Base):
    __tablename__ = "nudge_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=True, index=True)
    alert_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("alerts.id"), nullable=True, index=True)
    nudge_type: Mapped[str] = mapped_column(String(50), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False, default="dashboard")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OrderAssignmentDecision(Base):
    __tablename__ = "order_assignment_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    fleet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fleets.id"), nullable=True, index=True)
    order_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    assigned_driver_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    strategy: Mapped[str | None] = mapped_column(String(100), nullable=True)
    restaurant_wait_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    required_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    assignment_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    request_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChargingDecisionRecord(Base):
    __tablename__ = "charging_decision_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    driver_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    vehicle_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=True, index=True)
    order_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    chosen_option: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    selected_charger: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    wait_window: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    request_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WaitEvent(Base):
    __tablename__ = "wait_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    wait_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="telemetry")
    ignition_on: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    charge_plug: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    restaurant_distance_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    charger_distance_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True, index=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    soc_at_alert: Mapped[float | None] = mapped_column(Float, nullable=True)
    nearest_charger: Mapped[str | None] = mapped_column(String(255), nullable=True)
    charger_distance_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
