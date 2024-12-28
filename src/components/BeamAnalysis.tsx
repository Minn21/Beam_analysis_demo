"use client";
import React, { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
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

  // Improved validation with proper error messages
  const validateBeamLength = useCallback((value: number): boolean => {
    if (isNaN(value) || value <= 0) {
      alert("Beam length must be a positive number.");
      return false;
    }
    return true;
  }, []);

  const validateLoad = useCallback((load: Load): boolean => {
    if (isNaN(load.position) || load.position < 0 || load.position > beamLength) {
      alert(`Load position must be between 0 and ${beamLength} meters.`);
      return false;
    }

    if (isNaN(load.magnitude)) {
      alert("Load magnitude must be a number.");
      return false;
    }

    if (load.type === 'distributed') {
      if (isNaN(load.length) || load.length <= 0) {
        alert("Distributed load length must be positive.");
        return false;
      }
      if (load.position + load.length > beamLength) {
        alert("Distributed load must fit within the beam length.");
        return false;
      }
    }
    return true;
  }, [beamLength]);

  // Improved handlers with type safety
  const handleBeamLengthChange = (value: number) => {
    if (validateBeamLength(value)) {
      setBeamLength(value);
      // Validate existing loads with new beam length
      const invalidLoads = loads.filter(load => 
        load.position > value || 
        (load.type === 'distributed' && (load.position + load.length) > value)
      );
      if (invalidLoads.length > 0) {
        alert("Some loads were removed as they no longer fit within the new beam length.");
        setLoads(loads.filter(load => 
          load.position <= value && 
          (load.type !== 'distributed' || (load.position + load.length) <= value)
        ));
      }
    }
  };

  // Fixed calculation functions with proper type handling
  const calculateShear = useCallback((x: number): number => {
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
  }, [loads]);

  const calculateMoment = useCallback((x: number): number => {
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
  }, [loads]);

  // Improved diagram data generation with memoization
  const generateDiagramData = useCallback((): DiagramPoint[] => {
    const points = 100;
    const dx = beamLength / points;
    return Array.from({ length: points + 1 }, (_, i) => {
      const x = i * dx;
      return {
        position: Number(x.toFixed(3)),
        shear: Number(calculateShear(x).toFixed(3)),
        moment: Number(calculateMoment(x).toFixed(3))
      };
    });
  }, [beamLength, calculateShear, calculateMoment]);

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
      const updatedLoad = { ...load, [field]: field === 'type' ? value : Number(value) };
      return updatedLoad;
    });
    
    const updatedLoad = updatedLoads.find(load => load.id === id);
    if (updatedLoad && validateLoad(updatedLoad)) {
      setLoads(updatedLoads);
    }
  };

  const diagramData = generateDiagramData();

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
            onChange={(e) => handleBeamLengthChange(Number(e.target.value))}
            min="0.1"
            step="0.1"
            className="w-full max-w-xs px-3 py-2 border rounded-md"
            placeholder="Enter beam length"
            title="Beam Length"
            />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Loads</h3>
          {loads.map((load) => (
            <div key={load.id} className="grid grid-cols-5 gap-2 items-center">
             <select
                value={load.type}
                onChange={(e) => updateLoad(load.id, 'type', e.target.value as Load['type'])}
                className="px-3 py-2 border rounded-md"
                title="Select load type"
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
                step="0.1"
                placeholder="Position (m)"
                title="Position (m)"
                className="px-3 py-2 border rounded-md"
              />
              <input
                type="number"
                value={load.magnitude}
                onChange={(e) => updateLoad(load.id, 'magnitude', e.target.value)}
                step="0.1"
                placeholder={`${load.type === 'moment' ? 'Moment (kN·m)' : 'Force (kN)'}`}
                className="px-3 py-2 border rounded-md"
              />
              {load.type === 'distributed' && (
                <input
                  type="number"
                  value={load.length}
                  onChange={(e) => updateLoad(load.id, 'length', e.target.value)}
                  min="0.1"
                  max={beamLength - load.position}
                  step="0.1"
                  placeholder="Length (m)"
                  title="Length (m)"
                  className="w-full px-3 py-2 border rounded-md"
                />
              )}
              <button
                onClick={() => setLoads(loads.filter(l => l.id !== load.id))}
                className="w-full p-2 text-red-600 hover:bg-red-50 rounded-md"
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

        <div className="w-full space-y-6 items-center">
          <div>
            <h3 className="text-lg font-medium mb-2">Shear Force Diagram</h3>
            <LineChart width={800} height={300} data={diagramData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="position" 
                label={{ value: 'Position (m)', position: 'bottom' }} 
              />
              <YAxis 
                label={{ value: 'Shear Force (kN)', angle: -90, position: 'left' }} 
              />
              <Tooltip formatter={(value) => [`${value} kN`, 'Shear Force']} />
              <Line type="monotone" dataKey="shear" stroke="#2563eb" dot={false} />
            </LineChart>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-2">Bending Moment Diagram</h3>
            <LineChart width={800} height={300} data={diagramData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="position" 
                label={{ value: 'Position (m)', position: 'bottom' }} 
              />
              <YAxis 
                label={{ value: 'Bending Moment (kN·m)', angle: -90, position: 'left' }} 
              />
              <Tooltip formatter={(value) => [`${value} kN·m`, 'Bending Moment']} />
              <Line type="monotone" dataKey="moment" stroke="#dc2626" dot={false} />
            </LineChart>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeamAnalysis;