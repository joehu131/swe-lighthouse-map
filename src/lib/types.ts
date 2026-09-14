export interface BeaconSector {
  start_deg: number;
  end_deg: number;
  colour: string;
}

export interface BeaconFacts {
  name: string;
  character: string;
  period_s: number;
  range_nm: number;
  height_m: number;
  optic_type: 'havsfyr' | 'sektorfyr' | 'ensfyr';
  tier: 'major' | 'sector' | 'minor';
  ref: string | null;
  lat: number;
  lon: number;
  sectors: BeaconSector[];
}

export interface Beacon {
  id: string;
  name: string;
  ref: string | null;
  tier: 'major' | 'sector' | 'minor';
  u: number;
  v: number;
  reach: number;
  period: number;
  phase: number;
  rgb: [number, number, number];
  rotates: number;
  optic_type: 'havsfyr' | 'sektorfyr' | 'ensfyr';
  height_m: number;
  range_nm: number;
  sec_offset: number;
  nsec: number;
  facts: BeaconFacts;
}

export interface Manifest {
  subject: string;
  label: string;
  source: string;
  canvas: [number, number];
  plate: [number, number];
  aspect_h: number;
  frame_width_m: number;
  merc_bbox: [number, number, number, number];
  lat_center: number;
  elev_max_m: number;
  palette: {
    sea_night: [number, number, number];
    land_night: [number, number, number];
    sea_day: [number, number, number];
    land_day: [number, number, number];
    sky_beam: [number, number, number];
  };
  look: {
    ve: number;
    height_boost: number;
    exposure: number;
    beam_gain: number;
    sea_gain: number;
    ao: number;
    ambient: number;
  };
  n_beacons: number;
  beacons: Beacon[];
  sectors: [number, number, number, number][];
}
