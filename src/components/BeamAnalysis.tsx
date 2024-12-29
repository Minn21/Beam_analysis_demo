"use client";
import React, { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Trash2 } from 'lucide-react';

// Define TypeScript interfaces for better type safety
interface Load {
  id: number;
  type: 'point' | 'distributed' | 'moment';
  position: number;
  magnitude: number;
  length: number;
}

interface DiagramPoint {
  position: number;
  shear: number;
  moment: number;
  deflection: number;
}

const BeamAnalysis = () => {
  const [beamLength, setBeamLength] = useState<number>(5);
  const [loads, setLoads] = useState<Load[]>([
    { id: 1, type: 'point', position: 2.5, magnitude: -50, length: 0 }, // Negative magnitude for downward load
  ]);
  const [startSupportPosition, setStartSupportPosition] = useState<number>(0); // Position of the start support
  const [endSupportPosition, setEndSupportPosition] = useState<number>(5); // Position of the end support
  const [startSupport, setStartSupport] = useState<'pin' | 'roller' | 'fixed'>('pin');
  const [endSupport, setEndSupport] = useState<'pin' | 'roller' | 'fixed'>('roller');

  const [reactions, setReactions] = useState<{ reactionA: number; reactionB: number }>({ reactionA: 0, reactionB: 0 });

  // Calculate support reactions for a simply supported beam
  const calculateReactions = useCallback(() => {
    let reactionA = 0;
    let reactionB = 0;

    loads.forEach(load => {
      switch (load.type) {
        case 'point':
          reactionB += (Math.abs(load.magnitude) * (load.position - startSupportPosition)) / (endSupportPosition - startSupportPosition);
          reactionA += Math.abs(load.magnitude) - (Math.abs(load.magnitude) * (load.position - startSupportPosition)) / (endSupportPosition - startSupportPosition);
          break;
        case 'distributed':
          const distributedForce = Math.abs(load.magnitude) * load.length;
          const centerOfLoad = load.position + load.length / 2;
          reactionB += (distributedForce * (centerOfLoad - startSupportPosition)) / (endSupportPosition - startSupportPosition);
          reactionA += distributedForce - (distributedForce * (centerOfLoad - startSupportPosition)) / (endSupportPosition - startSupportPosition);
          break;
        case 'moment':
          reactionA -= load.magnitude / (endSupportPosition - startSupportPosition);
          reactionB += load.magnitude / (endSupportPosition - startSupportPosition);
          break;
      }
    });

    // Adjust reactions based on support types
    if (startSupport === 'fixed') reactionA = -reactionB; // Example adjustment
    if (endSupport === 'roller') reactionB = 0; // Example adjustment

    return { reactionA: Number(reactionA.toFixed(3)), reactionB: Number(reactionB.toFixed(3)) };
  }, [loads, startSupportPosition, endSupportPosition, startSupport, endSupport]);

  React.useEffect(() => {
    setReactions(calculateReactions());
  }, [calculateReactions]);

  // Calculate shear force at a position x
  const calculateShear = useCallback((x: number): number => {
    let shear = 0;

    if (x >= startSupportPosition) {
      shear += reactions.reactionA;
    }

    if (x >= endSupportPosition) {
      shear += reactions.reactionB;
    }

    loads.forEach(load => {
      switch (load.type) {
        case 'point': {
          if (x > load.position) {
            shear -= Math.abs(load.magnitude);
          }
          break;
        }
        case 'distributed': {
          if (x > load.position) {
            const effectiveLength = Math.min(x - load.position, load.length);
            shear -= Math.abs(load.magnitude) * effectiveLength;
          }
          break;
        }
      }
    });

    if (x > endSupportPosition) {
      shear = 0;
      loads.forEach(load => {
        if (load.position > endSupportPosition && x > load.position) {
          switch (load.type) {
            case 'point': {
              shear -= Math.abs(load.magnitude);
              break;
            }
            case 'distributed': {
              const effectiveLength = Math.min(x - load.position, load.length);
              shear -= Math.abs(load.magnitude) * effectiveLength;
              break;
            }
          }
        }
      });
    }

    return Number(shear.toFixed(3));
  }, [loads, reactions, startSupportPosition, endSupportPosition]);

  // Calculate bending moment at a position x
  const calculateMoment = useCallback((x: number): number => {
    let moment = 0;

    if (x >= startSupportPosition) {
      moment += reactions.reactionA * (x - startSupportPosition);
    }

    if (x >= endSupportPosition) {
      moment += reactions.reactionB * (x - endSupportPosition);
    }

    loads.forEach(load => {
      switch (load.type) {
        case 'point': {
          if (x > load.position) {
            moment -= Math.abs(load.magnitude) * (x - load.position);
          }
          break;
        }
        case 'distributed': {
          if (x > load.position) {
            const effectiveLength = Math.min(x - load.position, load.length);
            const centroid = load.position + effectiveLength / 2;
            moment -= Math.abs(load.magnitude) * effectiveLength * (x - centroid);
          }
          break;
        }
        case 'moment': {
          if (x > load.position) {
            moment -= load.magnitude;
          }
          break;
        }
      }
    });

    if (x > endSupportPosition) {
      moment = 0;
      loads.forEach(load => {
        if (load.position > endSupportPosition && x > load.position) {
          switch (load.type) {
            case 'point': {
              moment -= Math.abs(load.magnitude) * (x - load.position);
              break;
            }
            case 'distributed': {
              const effectiveLength = Math.min(x - load.position, load.length);
              const centroid = load.position + effectiveLength / 2;
              moment -= Math.abs(load.magnitude) * effectiveLength * (x - centroid);
              break;
            }
            case 'moment': {
              moment -= load.magnitude;
              break;
            }
          }
        }
      });
    }

    return Number(moment.toFixed(3));
  }, [loads, reactions, startSupportPosition, endSupportPosition]);

  // Calculate deflection at a position x
  const calculateVirtualMoment = useCallback((x: number, a: number): number => {
    if (x <= a) {
      return x * (beamLength - a) / beamLength;
    } else {
      return a * (beamLength - x) / beamLength;
    }
  }, [beamLength]);

  // Calculate deflection using virtual work method
  const calculateMEI = useCallback((x: number): number => {
    const E = 200e9; // Young's Modulus (Pa)
    const I = 8.33e-6; // Moment of Inertia (m^4)
    return calculateMoment(x) / (E * I);
  }, [calculateMoment]);
  
  // Calculate reactions for conjugate beam
  const calculateConjugateReactions = useCallback((): { Ra: number; Rb: number; Ma: number; Mb: number } => {
    const numPoints = 1000;
    const dx = beamLength / numPoints;
    let totalLoad = 0;
    let totalMoment = 0;
    
    // Calculate total load and moment from M/EI diagram
    for (let i = 0; i <= numPoints; i++) {
      const x = i * dx;
      const mei = calculateMEI(x);
      totalLoad += mei * dx;
      totalMoment += mei * x * dx;
    }
  
    let Ra = 0;
    let Rb = 0;
    let Ma = 0;
    let Mb = 0;
  
    // Set reactions based on support conditions
    if (startSupport === 'fixed' && endSupport === 'fixed') {
      // For fixed-fixed beam
      Ma = -totalMoment / 2;
      Mb = Ma;
      Ra = totalLoad / 2;
      Rb = Ra;
    } else if (startSupport === 'fixed' && endSupport === 'roller') {
      // For fixed-roller beam
      Ma = -totalMoment + totalLoad * beamLength / 2;
      Ra = totalLoad;
      Rb = 0;
      Mb = 0;
    } else if (startSupport === 'fixed') {
      // For fixed-pin beam
      Ma = -totalMoment + totalLoad * beamLength * 3/4;
      Ra = totalLoad;
      Rb = 0;
      Mb = 0;
    } else if (endSupport === 'fixed') {
      // For pin-fixed beam
      Mb = totalMoment - totalLoad * beamLength * 3/4;
      Ra = totalLoad;
      Rb = 0;
      Ma = 0;
    } else {
      // For simply supported beam
      Ra = totalLoad / 2;
      Rb = Ra;
      Ma = 0;
      Mb = 0;
    }
  
    return { Ra, Rb, Ma, Mb };
  }, [beamLength, calculateMEI, startSupport, endSupport]);
  
  // Calculate deflection using conjugate beam method
  const calculateDeflection = useCallback((x: number): number => {
    const numPoints = 1000;
    const dx = beamLength / numPoints;
    const { Ra, Rb, Ma, Mb } = calculateConjugateReactions();
    let deflection = 0;
  
    // Calculate deflection at point x using conjugate beam method
    for (let i = 0; i <= numPoints; i++) {
      const xi = i * dx;
      if (xi <= x) {
        // Add contribution from conjugate beam reactions and moments
        deflection += Ra * xi * dx;
        if (startSupport === 'fixed') {
          deflection += Ma * dx;
        }
        
        // Subtract M/EI area up to point x
        const mei = calculateMEI(xi);
        const lever = x - xi;
        deflection -= mei * lever * dx;
      }
    }
  
    // Apply boundary conditions
    if (startSupport === 'fixed') {
      const slope = calculateSlope(0);
      deflection -= slope * x;
    }
    if (endSupport === 'fixed') {
      const slope = calculateSlope(beamLength);
      deflection -= slope * (beamLength - x);
    }
  
    return Number(deflection.toFixed(6));
  }, [beamLength, calculateMEI, calculateConjugateReactions, startSupport, endSupport]);
  
  // Helper function to calculate slope at a point
  const calculateSlope = useCallback((x: number): number => {
    const numPoints = 1000;
    const dx = beamLength / numPoints;
    const { Ra, Rb, Ma, Mb } = calculateConjugateReactions();
    let slope = 0;
  
    for (let i = 0; i <= numPoints; i++) {
      const xi = i * dx;
      if (xi <= x) {
        const mei = calculateMEI(xi);
        slope += mei * dx;
      }
    }
  
    if (startSupport === 'fixed') {
      slope -= Ra;
    }
    if (endSupport === 'fixed') {
      slope += Rb;
    }
  
    return slope;
  }, [beamLength, calculateMEI, calculateConjugateReactions, startSupport, endSupport]);


  const generateDiagramData = useCallback((): DiagramPoint[] => {
    const points = 100;
    const dx = beamLength / points;
    return Array.from({ length: points + 1 }, (_, i) => {
      const x = i * dx;
      return {
        position: Number(x.toFixed(3)),
        shear: calculateShear(x),
        moment: calculateMoment(x),
        deflection: calculateDeflection(x)
      };
    });
  }, [beamLength, calculateShear, calculateMoment, calculateDeflection]);

  const diagramData = generateDiagramData();

  const addLoad = () => {
    const newLoad: Load = {
      id: Math.max(0, ...loads.map(l => l.id)) + 1,
      type: 'point',
      position: 0,
      magnitude: -10, // Default downward load
      length: 0
    };
    setLoads([...loads, newLoad]);
  };

  const updateLoad = (id: number, field: keyof Load, value: number | string) => {
    const updatedLoads = loads.map(load => {
      if (load.id !== id) return load;
      return { ...load, [field]: field === 'type' ? value : Number(value) };
    });
    setLoads(updatedLoads);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 bg-white rounded-lg shadow">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">Advanced Beam Analysis</h1>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Beam Length (m)</label>
          <input
            type="number"
            value={beamLength}
            onChange={(e) => setBeamLength(Number(e.target.value))}
            min="1"
            step="0.1"
            className="w-full max-w-xs px-3 py-2 border rounded-md"
            placeholder="Enter beam length"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Start Support Position (m)</label>
          <input
            type="number"
            value={startSupportPosition}
            onChange={(e) => setStartSupportPosition(Number(e.target.value))}
            min="0"
            max={beamLength}
            className="w-full max-w-xs px-3 py-2 border rounded-md"
            placeholder="Enter start support position"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Start Support</label>
          <select
            value={startSupport}
            onChange={(e) => setStartSupport(e.target.value as 'pin' | 'roller' | 'fixed')}
            className="w-full max-w-xs px-3 py-2 border rounded-md"
          >
            <option value="pin">Pin</option>
            <option value="roller">Roller</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">End Support Position (m)</label>
          <input
            type="number"
            value={endSupportPosition}
            onChange={(e) => setEndSupportPosition(Number(e.target.value))}
            min="0"
            max={beamLength}
            className="w-full max-w-xs px-3 py-2 border rounded-md"
            placeholder="Enter end support position"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">End Support</label>
          <select
            value={endSupport}
            onChange={(e) => setEndSupport(e.target.value as 'pin' | 'roller' | 'fixed')}
            className="w-full max-w-xs px-3 py-2 border rounded-md"
          >
            <option value="pin">Pin</option>
            <option value="roller">Roller</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Loads</h3>
          {loads.map(load => (
            <div key={load.id} className="grid grid-cols-5 gap-2 items-center">
              <label htmlFor={`load-type-${load.id}`} className="sr-only">Load Type</label>
              <select
                id={`load-type-${load.id}`}
                value={load.type}
                onChange={(e) => updateLoad(load.id, 'type', e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="point">Point Load</option>
                <option value="distributed">Distributed Load</option>
                <option value="moment">Moment</option>
              </select>
              <input
                type="number"
                value={load.position}
                onChange={(e) => updateLoad(load.id, 'position', e.target.value)}
                min="0"
                max={beamLength}
                className="px-3 py-2 border rounded-md"
                placeholder="Position (m)"
              />
              <input
                type="number"
                value={load.magnitude}
                onChange={(e) => updateLoad(load.id, 'magnitude', e.target.value)}
                className="px-3 py-2 border rounded-md"
                placeholder="Magnitude (Negative for downward load)"
              />
              {load.type === 'distributed' && (
                <input
                  type="number"
                  value={load.length}
                  onChange={(e) => updateLoad(load.id, 'length', e.target.value)}
                  min="0.1"
                  max={beamLength - load.position}
                  className="px-3 py-2 border rounded-md"
                  placeholder="Length (m)"
                />
              )}
              <button
                onClick={() => setLoads(loads.filter(l => l.id !== load.id))}
                className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                title="Remove Load"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addLoad}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Load
          </button>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Shear Force Diagram</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="shear" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Bending Moment Diagram</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="moment" stroke="#dc2626" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Deflection Diagram</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="deflection" stroke="#16a34a" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeamAnalysis;
