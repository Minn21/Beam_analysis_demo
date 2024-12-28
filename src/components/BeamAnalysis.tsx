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
}

const BeamAnalysis = () => {
  const [beamLength, setBeamLength] = useState<number>(5);
  const [loads, setLoads] = useState<Load[]>([
    { id: 1, type: 'point', position: 2, magnitude: -10, length: 0 },
    { id: 2, type: 'distributed', position: 1, magnitude: -5, length: 2 },
    { id: 3, type: 'moment', position: 3, magnitude: 15, length: 0 }
  ]);

  // Calculate support reactions for a simply supported beam
  const calculateReactions = useCallback(() => {
    let reactionA = 0;
    let reactionB = 0;

    loads.forEach(load => {
      switch (load.type) {
        case 'point':
          reactionB += (load.magnitude * load.position) / beamLength;
          reactionA += load.magnitude - (load.magnitude * load.position) / beamLength;
          break;
        case 'distributed':
          const distributedForce = load.magnitude * load.length;
          const centerOfLoad = load.position + load.length / 2;
          reactionB += (distributedForce * centerOfLoad) / beamLength;
          reactionA += distributedForce - (distributedForce * centerOfLoad) / beamLength;
          break;
        case 'moment':
          reactionA += load.magnitude / beamLength;
          reactionB -= load.magnitude / beamLength;
          break;
      }
    });

    return { reactionA: Number(reactionA.toFixed(3)), reactionB: Number(reactionB.toFixed(3)) };
  }, [loads, beamLength]);

  const reactions = calculateReactions();

  // Calculate shear force at a position x
  const calculateShear = useCallback((x: number): number => {
    let shear = reactions.reactionA;

    loads.forEach(load => {
      switch (load.type) {
        case 'point':
          if (x > load.position) shear += load.magnitude;
          break;
        case 'distributed':
          if (x > load.position) {
            const effectiveLength = Math.min(x - load.position, load.length);
            shear += load.magnitude * effectiveLength;
          }
          break;
      }
    });

    return Number(shear.toFixed(3));
  }, [loads, reactions]);

  // Calculate bending moment at a position x
  const calculateMoment = useCallback((x: number): number => {
    let moment = 0;

    loads.forEach(load => {
      switch (load.type) {
        case 'point':
          if (x > load.position) moment += load.magnitude * (x - load.position);
          break;
        case 'distributed':
          if (x > load.position) {
            const effectiveLength = Math.min(x - load.position, load.length);
            moment += load.magnitude * effectiveLength * (effectiveLength / 2);
          }
          break;
        case 'moment':
          if (x > load.position) moment += load.magnitude;
          break;
      }
    });

    moment += reactions.reactionA * x;
    return Number(moment.toFixed(3));
  }, [loads, reactions]);

  // Generate diagram data
  const generateDiagramData = useCallback((): DiagramPoint[] => {
    const points = 100;
    const dx = beamLength / points;
    return Array.from({ length: points + 1 }, (_, i) => {
      const x = i * dx;
      return {
        position: Number(x.toFixed(3)),
        shear: calculateShear(x),
        moment: calculateMoment(x)
      };
    });
  }, [beamLength, calculateShear, calculateMoment]);

  const diagramData = generateDiagramData();

  const addLoad = () => {
    const newLoad: Load = {
      id: Math.max(0, ...loads.map(l => l.id)) + 1,
      type: 'point',
      position: 0,
      magnitude: 0,
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
                placeholder="Magnitude"
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
      </div>
    </div>
  );
};

export default BeamAnalysis;
