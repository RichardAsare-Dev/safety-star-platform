CREATE TYPE public.batch_category AS ENUM ('Batch I','Batch II');
CREATE TYPE public.leadership_tier AS ENUM ('Lead','Coordinator','Non-Leadership');
CREATE TYPE public.nomination_action AS ENUM ('Check Batch I','Check Batch II','Request Support');
CREATE TYPE public.nomination_status AS ENUM ('Pending HSE Verification','Disqualified','Approved for HOD Evaluation','Completed');

CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  batch_category public.batch_category NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon, authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Departments are publicly readable" ON public.departments FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.users_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  mobile_contact TEXT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  position_title TEXT NOT NULL,
  leadership_tier public.leadership_tier NOT NULL DEFAULT 'Non-Leadership',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.users_employees TO anon, authenticated;
GRANT ALL ON public.users_employees TO service_role;
ALTER TABLE public.users_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees are publicly readable" ON public.users_employees FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.nominations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_name TEXT NOT NULL,
  action_type public.nomination_action NOT NULL,
  voter_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  nominee_id UUID REFERENCES public.users_employees(id) ON DELETE SET NULL,
  nominee_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  nominee_position_title TEXT,
  award_categories TEXT[] NOT NULL DEFAULT '{}',
  status public.nomination_status NOT NULL DEFAULT 'Pending HSE Verification',
  disqualification_reason TEXT,
  hse_score INTEGER,
  capa_closure_rate NUMERIC,
  recordable_injury BOOLEAN NOT NULL DEFAULT false,
  hod_duty_of_care SMALLINT,
  hod_safe_work_behavior SMALLINT,
  hod_hazard_awareness SMALLINT,
  hod_speaking_up SMALLINT,
  hod_participation SMALLINT,
  citation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.nominations TO anon, authenticated;
GRANT ALL ON public.nominations TO service_role;
ALTER TABLE public.nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nominations are publicly readable" ON public.nominations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can submit a nomination" ON public.nominations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can review a nomination" ON public.nominations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name TEXT NOT NULL,
  mobile_contact TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.support_requests TO anon, authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can request support" ON public.support_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.program_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voting_closes_at TIMESTAMPTZ NOT NULL,
  maturity_stage TEXT NOT NULL DEFAULT 'Proactive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.program_settings TO anon, authenticated;
GRANT ALL ON public.program_settings TO service_role;
ALTER TABLE public.program_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are publicly readable" ON public.program_settings FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.program_settings (voting_closes_at, maturity_stage) VALUES (now() + interval '18 days', 'Proactive');

INSERT INTO public.departments (name, batch_category) VALUES
 ('Organizational Capabilities','Batch I'),
 ('RO250 & RO500','Batch I'),
 ('AWTP','Batch I'),
 ('STP','Batch I'),
 ('NWTP','Batch I'),
 ('Engineering - Mechanical','Batch II'),
 ('Engineering - Electrical','Batch II'),
 ('Engineering - Planning','Batch II'),
 ('Processing - Pompora (RO140)','Batch II'),
 ('R&D / QA / QC','Batch II');

INSERT INTO public.users_employees (full_name, position_title, leadership_tier, department_id, email)
SELECT v.full_name, v.position_title, v.tier::public.leadership_tier, d.id, v.email
FROM (VALUES
 ('Kwame Mensah','Shift Lead','Lead','Organizational Capabilities','kwame.mensah@wtp.example'),
 ('Abena Owusu','Coordinator','Coordinator','Organizational Capabilities','abena.owusu@wtp.example'),
 ('Yaw Boateng','Officer','Non-Leadership','Organizational Capabilities','yaw.boateng@wtp.example'),
 ('Efua Danso','Deputy Lead','Lead','RO250 & RO500','efua.danso@wtp.example'),
 ('Kojo Asare','Plant Operator','Non-Leadership','RO250 & RO500','kojo.asare@wtp.example'),
 ('Adjoa Nyarko','Coordinator','Coordinator','RO250 & RO500','adjoa.nyarko@wtp.example'),
 ('Kofi Antwi','Shift Lead','Lead','AWTP','kofi.antwi@wtp.example'),
 ('Akosua Frimpong','Plant Operator','Non-Leadership','AWTP','akosua.frimpong@wtp.example'),
 ('Kwabena Adu','Forklift Operator','Non-Leadership','AWTP','kwabena.adu@wtp.example'),
 ('Ama Sarpong','Coordinator','Coordinator','STP','ama.sarpong@wtp.example'),
 ('Nana Appiah','Plant Operator','Non-Leadership','STP','nana.appiah@wtp.example'),
 ('Yaa Tetteh','Shift Lead','Lead','NWTP','yaa.tetteh@wtp.example'),
 ('Kwesi Amoah','Graduate Trainee (GT)','Non-Leadership','NWTP','kwesi.amoah@wtp.example'),
 ('Fiifi Bonsu','Mechanical Technician','Non-Leadership','Engineering - Mechanical','fiifi.bonsu@wtp.example'),
 ('Esi Kwarteng','Deputy Lead','Lead','Engineering - Mechanical','esi.kwarteng@wtp.example'),
 ('Kwadwo Larbi','Electrical Technician','Non-Leadership','Engineering - Electrical','kwadwo.larbi@wtp.example'),
 ('Maame Serwaa','Coordinator','Coordinator','Engineering - Electrical','maame.serwaa@wtp.example'),
 ('Kobby Osei','Planner','Coordinator','Engineering - Planning','kobby.osei@wtp.example'),
 ('Naa Ofori','Officer','Non-Leadership','Engineering - Planning','naa.ofori@wtp.example'),
 ('Kwaku Darko','Plant Operator','Non-Leadership','Processing - Pompora (RO140)','kwaku.darko@wtp.example'),
 ('Adwoa Baffour','Shift Lead','Lead','Processing - Pompora (RO140)','adwoa.baffour@wtp.example'),
 ('Selorm Agbo','Driver','Non-Leadership','Processing - Pompora (RO140)','selorm.agbo@wtp.example'),
 ('Doris Ansah','Officer','Non-Leadership','R&D / QA / QC','doris.ansah@wtp.example'),
 ('Emmanuel Quaye','NSP','Non-Leadership','R&D / QA / QC','emmanuel.quaye@wtp.example'),
 ('Patience Addo','Coordinator','Coordinator','R&D / QA / QC','patience.addo@wtp.example')
) AS v(full_name, position_title, tier, dept, email)
JOIN public.departments d ON d.name = v.dept;

INSERT INTO public.nominations (voter_name, action_type, voter_department_id, nominee_id, nominee_department_id, nominee_position_title, award_categories, status, disqualification_reason, hse_score, capa_closure_rate, recordable_injury, hod_duty_of_care, hod_safe_work_behavior, hod_hazard_awareness, hod_speaking_up, hod_participation, citation_note)
SELECT v.voter_name, v.action::public.nomination_action, e.department_id, e.id, e.department_id, e.position_title, v.cats, v.status::public.nomination_status, v.reason, v.hse, v.capa, v.injury, v.s1, v.s2, v.s3, v.s4, v.s5, v.citation
FROM (VALUES
 ('Gifty Amankwah','Check Batch I','Kwame Mensah', ARRAY['Monthly Safety Champion - Leadership (Lead)'],'Approved for HOD Evaluation',NULL,88,97.5,false,5,4,5,4,5,'Consistently leads pre-shift safety talks.'),
 ('Gifty Amankwah','Check Batch I','Abena Owusu', ARRAY['Quarterly Safety Champion - Leadership (Coordinator)'],'Pending HSE Verification',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Isaac Nkrumah','Check Batch I','Kojo Asare', ARRAY['Monthly Safety Champion - Non leadership'],'Completed',NULL,92,99.0,false,5,5,5,5,4,'Reported a critical valve hazard before failure.'),
 ('Isaac Nkrumah','Check Batch I','Akosua Frimpong', ARRAY['Monthly Safety Champion - Non leadership'],'Disqualified','Recordable injury logged in review period',54,88.0,true,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Mabel Owusu','Check Batch I','Kofi Antwi', ARRAY['Annual Safety Champion - Leadership (Lead)'],'Approved for HOD Evaluation',NULL,79,96.0,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Mabel Owusu','Check Batch I','Nana Appiah', ARRAY['Monthly Safety Champion - Non leadership'],'Pending HSE Verification',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Prince Baidoo','Check Batch I','Yaa Tetteh', ARRAY['Quarterly Safety Champion - Leadership (Lead)'],'Approved for HOD Evaluation',NULL,84,95.5,false,4,4,5,4,4,NULL),
 ('Prince Baidoo','Check Batch II','Fiifi Bonsu', ARRAY['Monthly Safety Champion - Non leadership'],'Pending HSE Verification',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Linda Mensah','Check Batch II','Esi Kwarteng', ARRAY['Quarterly Safety Champion - Leadership (Lead)'],'Completed',NULL,90,98.0,false,5,5,4,5,5,'Champion of the lockout-tagout refresh programme.'),
 ('Linda Mensah','Check Batch II','Kwadwo Larbi', ARRAY['Monthly Safety Champion - Non leadership'],'Disqualified','CAPA closure rate below 95%',66,91.0,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Samuel Tetteh','Check Batch II','Kobby Osei', ARRAY['Monthly Safety Champion - Leadership (Coordinator)'],'Approved for HOD Evaluation',NULL,81,96.5,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Samuel Tetteh','Check Batch II','Maame Serwaa', ARRAY['Annual Safety Champion - Leadership (Coordinator)'],'Pending HSE Verification',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Rita Oppong','Check Batch II','Kwaku Darko', ARRAY['Monthly Safety Champion - Non leadership'],'Approved for HOD Evaluation',NULL,86,97.0,false,4,5,4,4,5,NULL),
 ('Rita Oppong','Check Batch II','Adwoa Baffour', ARRAY['Quarterly Safety Champion - Leadership (Lead)'],'Pending HSE Verification',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Rita Oppong','Check Batch II','Doris Ansah', ARRAY['Monthly Safety Champion - Non leadership'],'Approved for HOD Evaluation',NULL,77,95.0,false,NULL,NULL,NULL,NULL,NULL,NULL),
 ('Felix Amoako','Check Batch II','Patience Addo', ARRAY['Quarterly Safety Champion - Leadership (Coordinator)'],'Pending HSE Verification',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL,NULL,NULL)
) AS v(voter_name, action, nominee, cats, status, reason, hse, capa, injury, s1, s2, s3, s4, s5, citation)
JOIN public.users_employees e ON e.full_name = v.nominee;

ALTER PUBLICATION supabase_realtime ADD TABLE public.nominations;