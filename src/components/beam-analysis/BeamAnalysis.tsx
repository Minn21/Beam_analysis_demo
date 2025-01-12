"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { Trash2, Info } from 'lucide-react';

interface Load {
  id: number;
  type: 'point' | 'distributed' | 'moment' | 'torsion';  // Added torsion type
  position: number;
  magnitude: number;
  length?: number;
}

interface DiagramPoint {
  position: number;
  shear: number;
  moment: number;
  torsion: number;  // Added torsion
  normalStress: number;
  shearStress: number;
  torsionalStress: number;  // Added torsional stress
  vonMisesStress: number;
}

interface SectionProperties {
  area: number;
  momentOfInertia: number;
  sectionModulus: number;
  polarMomentOfInertia: number;  // Added polar moment of inertia
  torsionalConstant: number;     // Added torsional constant
}

interface Reactions {
  reactionA: number;
  reactionB: number;
  momentA: number;
  momentB: number;
}

const BeamAnalysis = () => {
  // Basic beam properties with validation
  const [beamLength, setBeamLength] = useState<number>(5);
  const [beamHeight, setBeamHeight] = useState<number>(0.2);
  const [beamWidth, setBeamWidth] = useState<number>(0.1);

  // Support and loading configurations
  const [loads, setLoads] = useState<Load[]>([
    { id: 1, type: 'point', position: 2.5, magnitude: 50 },
  ]);
  const [startSupportPosition, setStartSupportPosition] = useState<number>(0);
  const [endSupportPosition, setEndSupportPosition] = useState<number>(4);
  const [startSupport, setStartSupport] = useState<'pin' | 'roller' | 'fixed'>('pin');
  const [endSupport, setEndSupport] = useState<'pin' | 'roller' | 'fixed'>('roller');
  const [showStressInfo, setShowStressInfo] = useState<boolean>(false);
  const [reactions, setReactions] = useState<Reactions>({
    reactionA: 0,
    reactionB: 0,
    momentA: 0,
    momentB: 0
  });

  // Validate beam dimensions
  const handleBeamLengthChange = (newLength: number) => {
    if (newLength > 0) {
      setBeamLength(newLength);
      setEndSupportPosition(Math.min(endSupportPosition, newLength));
      setLoads(prevLoads => 
        prevLoads.map(load => ({
          ...load,
          position: Math.min(load.position, newLength),
          length: load.length ? Math.min(load.length, newLength - load.position) : undefined
        }))
      );
    }
  };

  // Validate support positions
  const handleSupportPositionChange = (position: number, isStart: boolean) => {
    if (isStart) {
      if (position >= 0 && position < endSupportPosition) {
        setStartSupportPosition(position);
      }
    } else {
      if (position > startSupportPosition && position <= beamLength) {
        setEndSupportPosition(position);
      }
    }
  };

  const calculateSectionProperties = useCallback((): SectionProperties => {
    const area = Math.max(0.001, beamHeight * beamWidth);
    const momentOfInertia = (beamWidth * Math.pow(beamHeight, 3)) / 12;
    const sectionModulus = (2 * momentOfInertia) / beamHeight;
    
    // Calculate torsional properties for rectangular section
    const a = Math.max(beamWidth, beamHeight);
    const b = Math.min(beamWidth, beamHeight);
    const torsionalConstant = a * Math.pow(b, 3) * (1/3 - 0.21 * (b/a) * (1 - Math.pow(b/a, 4)/12));
    const polarMomentOfInertia = (beamWidth * Math.pow(beamHeight, 3) + beamHeight * Math.pow(beamWidth, 3)) / 12;

    return { 
      area, 
      momentOfInertia, 
      sectionModulus, 
      polarMomentOfInertia,
      torsionalConstant 
    };
  }, [beamHeight, beamWidth]);

  // Calculate torsional moment at a given position
  const calculateTorsion = useCallback((x: number): number => {
    if (x < startSupportPosition || x > endSupportPosition) return 0;
    
    let torsion = 0;
    
    loads.forEach(load => {
      if (load.type !== 'torsion' || load.position > x) return;
      
      if (load.type === 'torsion') {
        torsion += load.magnitude;
      }
    });

    return Number(torsion.toFixed(3));
  }, [loads, startSupportPosition, endSupportPosition]);

  // Calculate reactions with fixed end moments
  const calculateReactions = useCallback((): Reactions => {
    let reactionA = 0;
    let reactionB = 0;
    let momentA = 0;
    let momentB = 0;
    const span = endSupportPosition - startSupportPosition;

    if (span <= 0) return { reactionA: 0, reactionB: 0, momentA: 0, momentB: 0 };

    // Calculate fixed end moments first
    if (startSupport === 'fixed' || endSupport === 'fixed') {
      loads.forEach(load => {
        const a = load.position - startSupportPosition;
        const b = endSupportPosition - load.position;

        if (load.type === 'point' && a >= 0 && b >= 0) {
          const FEM = (load.magnitude * a * b * b) / (span * span);
          momentA += FEM;
          momentB += -FEM * (a / b);
        }
      });
    }

    // Calculate reactions considering moments
    loads.forEach(load => {
      if (load.position < startSupportPosition || load.position > endSupportPosition) return;

      const relativePosition = load.position - startSupportPosition;
      
      switch (load.type) {
        case 'point':
          reactionB = (Math.abs(load.magnitude) * relativePosition) / span;
          reactionA = Math.abs(load.magnitude) - reactionB;
          break;
        case 'distributed':
          if (load.length) {
            const startX = Math.max(load.position, startSupportPosition);
            const endX = Math.min(load.position + load.length, endSupportPosition);
            const effectiveLength = endX - startX;
            const totalForce = Math.abs(load.magnitude) * effectiveLength;
            const centerOfForce = startX + effectiveLength / 2 - startSupportPosition;
            reactionB = (totalForce * centerOfForce) / span;
            reactionA = totalForce - reactionB;
          }
          break;
        case 'moment':
          reactionB = load.magnitude / span;
          reactionA = -reactionB;
          break;
      }
    });

    // Adjust reactions for fixed supports
    if (startSupport === 'fixed' && endSupport === 'fixed') {
      const adjustment = (momentA - momentB) / span;
      reactionA += adjustment;
      reactionB -= adjustment;
    } else if (startSupport === 'fixed') {
      reactionA += momentA / span;
      reactionB -= momentA / span;
    } else if (endSupport === 'fixed') {
      reactionA += momentB / span;
      reactionB -= momentB / span;
    }

    return {
      reactionA: Number(reactionA.toFixed(3)),
      reactionB: Number(reactionB.toFixed(3)),
      momentA: Number(momentA.toFixed(3)),
      momentB: Number(momentB.toFixed(3))
    };
  }, [loads, startSupportPosition, endSupportPosition, startSupport, endSupport]);

  // Calculate shear force
  const calculateShear = useCallback((x: number): number => {
    if (x < startSupportPosition || x > endSupportPosition) return 0;
    
    let shear = reactions.reactionA;
    
    loads.forEach(load => {
      if (load.position > x) return;

      switch (load.type) {
        case 'point':
          shear -= load.magnitude;
          break;
        case 'distributed':
          if (load.length) {
            const endX = Math.min(x, load.position + load.length);
            const effectiveLength = endX - load.position;
            if (effectiveLength > 0) {
              shear -= load.magnitude * effectiveLength;
            }
          }
          break;
      }
    });

    return Number(shear.toFixed(3));
  }, [loads, reactions, startSupportPosition, endSupportPosition]);

  // Calculate bending moment
  const calculateMoment = useCallback((x: number): number => {
    if (x < startSupportPosition || x > endSupportPosition) return 0;
    
    let moment = reactions.reactionA * (x - startSupportPosition);
    if (startSupport === 'fixed') moment += reactions.momentA;
    
    loads.forEach(load => {
      if (load.position > x) return;

      switch (load.type) {
        case 'point':
          moment -= load.magnitude * (x - load.position);
          break;
        case 'distributed':
          if (load.length) {
            const endX = Math.min(x, load.position + load.length);
            const effectiveLength = endX - load.position;
            if (effectiveLength > 0) {
              const centroid = load.position + effectiveLength / 2;
              moment -= load.magnitude * effectiveLength * (x - centroid);
            }
          }
          break;
        case 'moment':
          moment -= load.magnitude;
          break;
      }
    });

    return Number(moment.toFixed(3));
  }, [loads, reactions, startSupportPosition, startSupport]);

  // Update stress calculations to include torsional stress
  const calculateStresses = useCallback((x: number): { 
    normalStress: number; 
    shearStress: number; 
    torsionalStress: number;
    vonMisesStress: number; 
  } => {
    const { momentOfInertia, sectionModulus, torsionalConstant } = calculateSectionProperties();
    const moment = calculateMoment(x);
    const shear = calculateShear(x);
    const torsion = calculateTorsion(x);

    const normalStress = Math.abs(moment) / sectionModulus / 1e6;
    const Q = (beamWidth * beamHeight * beamHeight) / 8;
    const shearStress = Math.abs(shear * Q) / (momentOfInertia * beamWidth) / 1e6;
    // Calculate torsional stress
    const maxTorsionalStress = Math.abs(torsion * beamHeight) / (2 * torsionalConstant) / 1e6;
    
    // Update von Mises stress to include torsional effects
    const vonMisesStress = Math.sqrt(
      Math.pow(normalStress, 2) + 
      3 * (Math.pow(shearStress, 2) + Math.pow(maxTorsionalStress, 2))
    );

    return {
      normalStress: Number(normalStress.toFixed(3)),
      shearStress: Number(shearStress.toFixed(3)),
      torsionalStress: Number(maxTorsionalStress.toFixed(3)),
      vonMisesStress: Number(vonMisesStress.toFixed(3))
    };
  }, [calculateMoment, calculateShear, calculateTorsion, calculateSectionProperties, beamWidth, beamHeight]);

  // Update diagram data generation to include torsion
  const generateDiagramData = useCallback((): DiagramPoint[] => {
    const points = 100;
    const dx = beamLength / points;
    return Array.from({ length: points + 1 }, (_, i) => {
      const x = Number((i * dx).toFixed(3));
      const stresses = calculateStresses(x);
      return {
        position: x,
        shear: calculateShear(x),
        moment: calculateMoment(x),
        torsion: calculateTorsion(x),
        ...stresses
      };
    });
  }, [beamLength, calculateShear, calculateMoment, calculateTorsion, calculateStresses]);


  // Update reactions when inputs change
  useEffect(() => {
    setReactions(calculateReactions());
  }, [calculateReactions]);

  // Add new load
  const addLoad = () => {
    const newLoad: Load = {
      id: Math.max(0, ...loads.map(l => l.id)) + 1,
      type: 'point',
      position: beamLength / 2,
      magnitude: -10
    };
    setLoads([...loads, newLoad]);
  };

  // Update load
  const updateLoad = (id: number, field: keyof Load, value: string | number) => {
    setLoads(loads.map(load => {
      if (load.id !== id) return load;
      
      let updatedValue = value;
      if (field === 'position') {
        updatedValue = Math.max(0, Math.min(beamLength, Number(value)));
      } else if (field === 'length') {
        updatedValue = Math.max(0, Math.min(beamLength - load.position, Number(value)));
      }
      
      return { ...load, [field]: field === 'type' ? value : Number(updatedValue) };
    }));
  };

  const diagramData = generateDiagramData();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 bg-white rounded-lg shadow">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">Advanced Beam Analysis</h1>
        <p className="text-gray-600">Analyze beams with various loads and support conditions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Beam Length (m)</label>
            <input
              type="number"
              value={beamLength}
              onChange={(e) => handleBeamLengthChange(Number(e.target.value))}
              min="1"
              step="0.1"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beam Height (m)</label>
            <input
              type="number"
              value={beamHeight}
              onChange={(e) => setBeamHeight(Number(e.target.value))}
              min="0.01"
              step="0.01"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beam Width (m)</label>
            <input
              type="number"
              value={beamWidth}
              onChange={(e) => setBeamWidth(Number(e.target.value))}
              min="0.01"
              step="0.01"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Support Position (m)</label>
            <input
              type="number"
              value={startSupportPosition}
              onChange={(e) => handleSupportPositionChange(Number(e.target.value), true)}
              min="0"
              max={endSupportPosition}
              step="0.1"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Start Support Type</label>
            <select
              value={startSupport}
              onChange={(e) => setStartSupport(e.target.value as 'pin' | 'roller' | 'fixed')}
              className="w-full px-3 py-2 border rounded-md"
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
              onChange={(e) => handleSupportPositionChange(Number(e.target.value), false)}
              min={startSupportPosition}
              max={beamLength}
              step="0.1"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Support Type</label>
            <select
              value={endSupport}
              onChange={(e) => setEndSupport(e.target.value as 'pin' | 'roller' | 'fixed')}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="pin">Pin</option>
              <option value="roller">Roller</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Loads</h3>
          <button
            onClick={() => setShowStressInfo(!showStressInfo)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <Info className="w-4 h-4" />
            {showStressInfo ? 'Hide' : 'Show'} Reactions
          </button>
        </div>

        <div className="space-y-2">
          {loads.map(load => (
            <div key={load.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center bg-gray-50 p-2 rounded-md">
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
                <option value="torsion">Torsion</option>
              </select>
              
              <input
                type="number"
                value={load.position}
                onChange={(e) => updateLoad(load.id, 'position', e.target.value)}
                min="0"
                max={beamLength}
                step="0.1"
                className="px-3 py-2 border rounded-md"
                placeholder="Position (m)"
              />
              
              <input
                type="number"
                value={load.magnitude}
                onChange={(e) => updateLoad(load.id, 'magnitude', e.target.value)}
                step="0.1"
                className="px-3 py-2 border rounded-md"
                placeholder={load.type === 'moment' ? 'Moment (kN⋅m)' : 'Load (kN)'}
              />
              
              {load.type === 'distributed' && (
                <input
                  type="number"
                  value={load.length}
                  onChange={(e) => updateLoad(load.id, 'length', e.target.value)}
                  min="0.1"
                  max={beamLength - load.position}
                  step="0.1"
                  className="px-3 py-2 border rounded-md"
                  placeholder="Length (m)"
                />
              )}
              
              <button
                onClick={() => setLoads(loads.filter(l => l.id !== load.id))}
                className="p-2 text-red-600 hover:bg-red-100 rounded-md"
                title="Remove Load"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={addLoad}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Add Load
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Shear Force Diagram</h3>
          <div className="w-full h-64 bg-gray-50 rounded-lg p-4">
            <ResponsiveContainer>
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="position"
                  label={{ value: 'Position (m)', position: 'bottom' }}
                />
                <YAxis
                  label={{ value: 'Shear Force (kN)', angle: -90, position: 'left' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} kN`, 'Shear Force']}
                  labelFormatter={(label) => `Position: ${label} m`}
                />
                <Line 
                  type="monotone"
                  dataKey="shear"
                  stroke="#2563eb"
                  dot={false}
                  name="Shear Force"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Bending Moment Diagram</h3>
          <div className="w-full h-64 bg-gray-50 rounded-lg p-4">
            <ResponsiveContainer>
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="position"
                  label={{ value: 'Position (m)', position: 'bottom' }}
                />
                <YAxis
                  label={{ value: 'Bending Moment (kN⋅m)', angle: -90, position: 'left' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} kN⋅m`, 'Bending Moment']}
                  labelFormatter={(label) => `Position: ${label} m`}
                />
                <Line 
                  type="monotone"
                  dataKey="moment"
                  stroke="#dc2626"
                  dot={false}
                  name="Bending Moment"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
        <h3 className="text-lg font-medium mb-2">Torsion Diagram</h3>
        <div className="w-full h-64 bg-gray-50 rounded-lg p-4">
          <ResponsiveContainer>
            <LineChart data={diagramData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="position"
                label={{ value: 'Position (m)', position: 'bottom' }}
              />
              <YAxis
                label={{ value: 'Torsional Moment (kN⋅m)', angle: -90, position: 'left' }}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} kN⋅m`, 'Torsion']}
                labelFormatter={(label) => `Position: ${label} m`}
              />
              <Line 
                type="monotone"
                dataKey="torsion"
                stroke="#7c3aed"
                dot={false}
                name="Torsion"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>


        {/* Update Stress Distribution to include torsional stress */}
      {showStressInfo && (
        <div>
          <h3 className="text-lg font-medium mb-2">Stress Distribution</h3>
          <div className="w-full h-64 bg-gray-50 rounded-lg p-4">
            <ResponsiveContainer>
              <LineChart data={diagramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="position"
                  label={{ value: 'Position (m)', position: 'bottom' }}
                />
                <YAxis
                  label={{ value: 'Stress (MPa)', angle: -90, position: 'left' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} MPa`]}
                  labelFormatter={(label) => `Position: ${label} m`}
                />
                <Legend />
                <Line 
                  type="monotone"
                  dataKey="normalStress"
                  stroke="#2563eb"
                  dot={false}
                  name="Normal Stress"
                />
                <Line 
                  type="monotone"
                  dataKey="shearStress"
                  stroke="#dc2626"
                  dot={false}
                  name="Shear Stress"
                />
                <Line 
                  type="monotone"
                  dataKey="torsionalStress"
                  stroke="#7c3aed"
                  dot={false}
                  name="Torsional Stress"
                />
                <Line 
                  type="monotone"
                  dataKey="vonMisesStress"
                  stroke="#047857"
                  dot={false}
                  name="von Mises Stress"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  </div>
)};

export default BeamAnalysis;