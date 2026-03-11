-- 006_patients.sql

CREATE TYPE biological_sex   AS ENUM ('male', 'female');
CREATE TYPE work_type        AS ENUM ('office','manual_construction','healthcare',
                                      'education','transportation','agriculture','retail_sales',
                                      'industrial_factory','domestic','student','retired','unemployed','other');
CREATE TYPE work_schedule    AS ENUM ('day','night','irregular');
CREATE TYPE activity_level   AS ENUM ('low','moderate','high');
CREATE TYPE smoking_status   AS ENUM ('never','current','former');
CREATE TYPE bp_status        AS ENUM ('none','controlled','uncontrolled','unknown');
CREATE TYPE diabetes_type    AS ENUM ('none','type1','type2','unknown');
CREATE TYPE diabetes_control AS ENUM ('controlled','uncontrolled','unknown','na');
CREATE TYPE diabetes_tx      AS ENUM ('tablets','insulin','both','none','na');
CREATE TYPE condition_status AS ENUM ('none','known','unknown');
CREATE TYPE risk_level       AS ENUM ('low','medium','high');

CREATE TABLE patients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID REFERENCES tenants(id),  -- NULL = platform patient
  phone_number  TEXT NOT NULL,
  name_ar       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phone_number, tenant_id)
);

CREATE TABLE patient_profiles (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE UNIQUE,
  age                  INTEGER,
  biological_sex       biological_sex,
  governorate_id       UUID REFERENCES governorates(id),
  height_cm            INTEGER,
  weight_kg            DECIMAL(5,2),
  bmi                  DECIMAL(4,1) GENERATED ALWAYS AS
                         (ROUND((weight_kg / ((height_cm::DECIMAL/100)^2))::DECIMAL, 1)) STORED,
  work_type            work_type,
  work_schedule        work_schedule,
  activity_level       activity_level,
  smoking_status       smoking_status DEFAULT 'never',
  cigarettes_per_day   INTEGER,
  smoking_years        INTEGER,
  blood_pressure       bp_status DEFAULT 'none',
  bp_on_medication     BOOLEAN,
  diabetes_type        diabetes_type DEFAULT 'none',
  diabetes_control     diabetes_control DEFAULT 'na',
  diabetes_treatment   diabetes_tx DEFAULT 'na',
  heart_condition      condition_status DEFAULT 'none',
  previous_heart_attack BOOLEAN NOT NULL DEFAULT false,
  heart_surgery        BOOLEAN NOT NULL DEFAULT false,
  kidney_disease       condition_status DEFAULT 'none',
  liver_disease        condition_status DEFAULT 'none',
  chronic_conditions   TEXT[] DEFAULT '{}',
  known_allergies      TEXT,
  current_medications  TEXT,
  previous_surgeries   BOOLEAN NOT NULL DEFAULT false,
  surgery_notes        TEXT,
  background_risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level           risk_level NOT NULL DEFAULT 'low',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
