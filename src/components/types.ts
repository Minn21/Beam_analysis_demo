export interface Load {
    id: number;
    type: 'point' | 'distributed' | 'moment';
    position: number;
    magnitude: number;
    length: number;
  }
  
  export interface DiagramPoint {
    position: number;
    shear: number;
    moment: number;
  }
  
  export interface ValidationResult {
    isValid: boolean;
    message?: string;
  }
  