"use client";

import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { divisionFlows, divisions } from "@/data/divisions";
import type { Division, DivisionId } from "@/types";
import { DivisionNode, DivisionNodeData } from "./DivisionNode";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";

const accentHex: Record<Division["accent"], string> = {
  neon: "#39ff8b",
  teal: "#1fe0c8",
  electric: "#3da9ff",
};

const nodeTypes = { division: DivisionNode };

function MapInner() {
  const [selectedId, setSelectedId] = useState<DivisionId | null>(null);

  const initialNodes: Node<DivisionNodeData>[] = useMemo(
    () =>
      divisions.map((d) => ({
        id: d.id,
        type: "division",
        position: d.position,
        data: { division: d, selected: false },
      })),
    []
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      divisionFlows.map((f) => {
        const src = divisions.find((d) => d.id === f.source)!;
        return {
          id: f.id,
          source: f.source,
          target: f.target,
          label: f.label,
          animated: true,
          style: { stroke: accentHex[src.accent], strokeWidth: 1.5 },
          labelStyle: { fill: "#94a3b8", fontSize: 10 },
          labelBgStyle: { fill: "#0a0e17", fillOpacity: 0.8 },
        };
      }),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const id = node.id as DivisionId;
      setSelectedId(id);
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, selected: n.id === id },
        }))
      );
    },
    [setNodes]
  );

  const selected = divisions.find((d) => d.id === selectedId) ?? null;

  const closePanel = () => {
    setSelectedId(null);
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, selected: false } }))
    );
  };

  return (
    <div className="relative h-[620px] w-full overflow-hidden rounded-2xl border border-white/5 bg-base-900/60">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="#1d2435"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      <NodeDetailPanel division={selected} onClose={closePanel} />
    </div>
  );
}

export function BusinessMap() {
  return (
    <section>
      <SectionHeader
        eyebrow="Strategy → Execution"
        title="Animated Business Map"
        description="Every division, live. Flows trace value from origination through ownership to client reporting. Click any node for KPIs, risks, owners and active projects."
      />
      <ReactFlowProvider>
        <MapInner />
      </ReactFlowProvider>
    </section>
  );
}
