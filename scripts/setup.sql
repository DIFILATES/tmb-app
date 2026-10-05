-- Taula objectes (trobats i perduts)
CREATE TABLE IF NOT EXISTS public.objectes (
  id bigint generated always as identity primary key,
  tipus text not null check (tipus in ('trobat', 'perdut')),
  que text not null,
  categoria text not null default 'altres',
  linia text,
  estacio text,
  data_objecte date,
  hora text,
  descripcio text,
  contacte text,
  nom text default 'Anonim',
  status text not null default 'disponible',
  created_at timestamptz default now()
);

-- Taula matches
CREATE TABLE IF NOT EXISTS public.matches (
  id bigint generated always as identity primary key,
  trobat_id bigint references public.objectes(id),
  perdut_id bigint references public.objectes(id),
  status text not null default 'pendent' check (status in ('pendent', 'confirmat', 'tancat')),
  notes text,
  created_at timestamptz default now(),
  closed_at timestamptz
);

-- Habilitar RLS
ALTER TABLE public.objectes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Politiques: tothom pot llegir
CREATE POLICY "Lectura publica objectes" ON public.objectes FOR SELECT USING (true);
CREATE POLICY "Lectura publica matches" ON public.matches FOR SELECT USING (true);

-- Politiques: tothom pot inserir (per als formularis)
CREATE POLICY "Insercio publica objectes" ON public.objectes FOR INSERT WITH CHECK (true);
CREATE POLICY "Insercio publica matches" ON public.matches FOR INSERT WITH CHECK (true);

-- Politiques: tothom pot actualitzar (per gestio)
CREATE POLICY "Update public objectes" ON public.objectes FOR UPDATE USING (true);
CREATE POLICY "Update public matches" ON public.matches FOR UPDATE USING (true);
