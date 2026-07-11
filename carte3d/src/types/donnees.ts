export interface SceneFestival {
  scene_id: number;
  nom: string;
  genre: string;
  capacite: number;
}

export interface LigneAffluence {
  jour: number;
  creneau: number;
  scene_id: number;
  nb_visiteurs: number;
}

export interface LigneFlux {
  jour: number;
  creneau: number;
  scene_origine: number;
  scene_destination: number;
  nb: number;
}

export interface Poi {
  poi_id: number;
  type: string;
  nom: string;
  x: number;
  y: number;
}

export interface Anomalie {
  jour: number;
  creneau: number;
  scene_id: number;
  type: string;
  gravite: string;
  source: string;
}

export interface Concert {
  concert_id: number;
  jour: number;
  scene_id: number;
  artiste: string;
  genre: string;
  heure_debut: number;
  heure_fin: number;
  popularite: number;
}

export interface Donnees {
  scenes: SceneFestival[];
  affluence: LigneAffluence[];
  flux: LigneFlux[];
  pois: Poi[];
  anomalies: Anomalie[];
  programmation: Concert[];
  jours_long: Record<string, string>;
}

export interface OptionsMontage {
  donnees: Donnees;
  jour?: number;
  onScene?: (sceneId: number) => void;
  onPoi?: (poi: Poi) => void;
}

export interface ApiCarte3D {
  setJour: (jour: number) => void;
  demonte: () => void;
}
