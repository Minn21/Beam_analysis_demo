import { Load, DiagramPoint, ValidationResult } from '@/components/types';

export const validateBeamLength = (value: number): ValidationResult => {
  if (isNaN(value) || value <= 0) {
    return {
      isValid: false,
      message: "Beam length must be a positive number."
    };
  }
  return { isValid: true };
};

export const validateLoad = (load: Load, beamLength: number): ValidationResult => {
  if (isNaN(load.position) || load.position < 0 || load.position > beamLength) {
    return {
      isValid: false,
      message: `Load position must be between 0 and ${beamLength} meters.`
    };
  }

  if (isNaN(load.magnitude)) {
    return {
      isValid: false,
      message: "Load magnitude must be a number."
    };
  }

  if (load.type === 'distributed') {
    if (isNaN(load.length) || load.length <= 0) {
      return {
        isValid: false,
        message: "Distributed load length must be positive."
      };
    }
    if (load.position + load.length > beamLength) {
      return {
        isValid: false,
        message: "Distributed load must fit within the beam length."
      };
    }
  }
  
  return { isValid: true };
};

export const calculateShear = (x: number, loads: Load[]): number => {
  return loads.reduce((shear, load) => {
    switch (load.type) {
      case 'point':
        return shear + (x > load.position ? load.magnitude : 0);
      case 'distributed':
        if (x <= load.position) return shear;
        if (x <= load.position + load.length) {
          return shear + load.magnitude * (x - load.position);
        }
        return shear + load.magnitude * load.length;
      default:
        return shear;
    }
  }, 0);
};

export const calculateMoment = (x: number, loads: Load[]): number => {
  return loads.reduce((moment, load) => {
    switch (load.type) {
      case 'point':
        return moment + (x > load.position ? load.magnitude * (x - load.position) : 0);
      case 'distributed':
        if (x <= load.position) return moment;
        if (x <= load.position + load.length) {
          const partialLength = x - load.position;
          return moment + load.magnitude * partialLength * partialLength / 2;
        }
        return moment + load.magnitude * load.length * (x - load.position - load.length / 2);
      case 'moment':
        return moment + (x > load.position ? load.magnitude : 0);
      default:
        return moment;
    }
  }, 0);
};
export const generateDiagramData = (beamLength: number, loads: Load[]): DiagramPoint[] => {
    const points = 100;
    const dx = beamLength / points;
    return Array.from({ length: points + 1 }, (_, i) => {
      const x = i * dx;
      return {
        position: Number(x.toFixed(3)),
        shear: Number(calculateShear(x, loads).toFixed(3)),
        moment: Number(calculateMoment(x, loads).toFixed(3))
      };
    });
  };