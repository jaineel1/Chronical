import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import type { WebEdge, WebNode, WebNodeType } from '@/data/types';
import { formatShortDate } from '@/lib/dates';
import { PixelSprite } from '@/ui/PixelSprite';
import { Button, Chip, Empty, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { MID_PALETTE } from '@/ui/sprites';
import { filterNodes, sortNodes, useWebGraph } from './queries';
import { deleteWebNode } from './webWrites';
import { WEB_GLYPH, WEB_TYPES, WEB_TYPE_LABEL } from './webSprites';

const EDITOR_PATH: Partial<Record<WebNodeType, string>> = {
  person: 'people',
  goal: 'goals',
  routine: 'routines',
  book: 'books',
  skill: 'skills',
};

/** `/web`: everything the game master has learned, browsable. List on the left, the node on the right. */
export function WebScreen() {
  useShellBar('Mind web');
  const graph = useWebGraph();
  const [type, setType] = useState<WebNodeType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();

  const nodes = graph?.nodes;
  const shown = useMemo(() => (nodes ? sortNodes(filterNodes(nodes, type, query)) : []), [nodes, type, query]);
  const presentTypes = useMemo(() => WEB_TYPES.filter((t) => nodes?.some((n) => n.type === t)), [nodes]);

  if (!graph) return <Page wide>{null}</Page>;
  if (graph.nodes.length === 0) {
    return (
      <Page wide>
        <Section>
          <Empty>The web grows from your nightly logs. Nothing yet.</Empty>
        </Section>
      </Page>
    );
  }

  const selected = graph.nodes.find((n) => n.id === selectedId);
  return (
    <Page wide>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={type === 'all'} onClick={() => setType('all')}>
          All
        </Chip>
        {presentTypes.map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {WEB_TYPE_LABEL[t]}
          </Chip>
        ))}
      </div>
      <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the web" aria-label="Search the web" />
      <div className="grid grid-cols-1 gap-6 pt-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <div className={`flex min-w-0 flex-col ${selected ? 'max-lg:hidden' : ''}`} data-testid="web-list">
          {shown.length === 0 ? <span className="text-mid">Nothing matches. Clear the search or pick All.</span> : null}
          {shown.map((n, i) => (
            <NodeRow key={n.id} node={n} first={i === 0} active={n.id === selectedId} onOpen={() => setSelectedId(n.id)} />
          ))}
        </div>
        <div className={`min-w-0 ${selected ? '' : 'max-lg:hidden'}`} data-testid="web-detail">
          {selected ? (
            <Detail
              key={selected.id}
              node={selected}
              nodes={graph.nodes}
              edges={graph.edges}
              onSelect={setSelectedId}
              onBack={() => setSelectedId(undefined)}
            />
          ) : (
            <span className="text-mid">Pick a node to read what the game master knows.</span>
          )}
        </div>
      </div>
    </Page>
  );
}

function Importance({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-[2px]" role="img" aria-label={`importance ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`block h-[6px] w-[6px] border ${i <= value ? 'border-ink bg-ink' : 'border-faint'}`} />
      ))}
    </span>
  );
}

function NodeRow({ node, first, active, onOpen }: { node: WebNode; first: boolean; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      className={`flex w-full cursor-pointer items-start gap-3 border-0 bg-transparent px-0 py-2 text-left text-ink ${first ? '' : 'border-t border-faint'} ${active ? 'bg-paper-2' : ''}`}
    >
      <PixelSprite map={WEB_GLYPH[node.type]} palette={MID_PALETTE} scale={2} label={node.type} className="mt-[2px]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words">{node.label}</span>
        <span className="text-mid">
          seen {formatShortDate(node.lastSeen)}, {node.mentions} {node.mentions === 1 ? 'mention' : 'mentions'}
        </span>
      </span>
      <Importance value={node.importance} />
    </button>
  );
}

function Detail({
  node,
  nodes,
  edges,
  onSelect,
  onBack,
}: {
  node: WebNode;
  nodes: WebNode[];
  edges: WebEdge[];
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const links = edges
    .filter((e) => e.from === node.id || e.to === node.id)
    .map((e) => {
      const outgoing = e.from === node.id;
      return { edge: e, outgoing, other: byId.get(outgoing ? e.to : e.from) };
    })
    .filter((l): l is { edge: WebEdge; outgoing: boolean; other: WebNode } => l.other !== undefined);
  const facts = [...node.facts].sort((a, b) => b.date.localeCompare(a.date));
  const editorPath = EDITOR_PATH[node.type];
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <Button variant="text" className="lg:hidden" onClick={onBack}>
        Back to the list
      </Button>
      <SectionHeader title={node.label} note={`${node.type}, since ${formatShortDate(node.firstSeen)}`} />
      <Section>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-mid">
            <Importance value={node.importance} />
            <span>
              seen {formatShortDate(node.lastSeen)}, {node.mentions} {node.mentions === 1 ? 'mention' : 'mentions'}
            </span>
          </div>
          {node.summaryMd ? <p className="m-0 whitespace-pre-line break-words">{node.summaryMd}</p> : null}
          {editorPath && node.refId ? (
            <Link to={`/edit/${editorPath}/${node.refId}`} className="self-start text-walnut no-underline">
              Open in the editor
            </Link>
          ) : null}
        </div>
      </Section>
      {links.length ? (
        <>
          <SectionHeader title="Connections" note={String(links.length)} />
          <Section>
            <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="web-edges">
              {links.map(({ edge, outgoing, other }) => (
                <li key={edge.id} className="break-words">
                  {outgoing ? (
                    <>
                      <span className="text-mid">{edge.relation} → </span>
                      <NodeLink node={other} onSelect={onSelect} />
                    </>
                  ) : (
                    <>
                      <NodeLink node={other} onSelect={onSelect} />
                      <span className="text-mid"> → {edge.relation} this</span>
                    </>
                  )}
                  {edge.note ? <span className="text-mid">, {edge.note}</span> : null}
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
      {facts.length ? (
        <>
          <SectionHeader title="Facts" note={String(facts.length)} />
          <Section>
            <ul className="m-0 flex list-none flex-col p-0">
              {facts.map((f, i) => (
                <li key={`${f.date}-${i}`} className={`flex gap-3 py-1.5 ${i > 0 ? 'border-t border-faint' : ''}`}>
                  <span className="w-[72px] shrink-0 text-mid">{formatShortDate(f.date)}</span>
                  <span className="min-w-0 flex-1 break-words">{f.text}</span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : null}
      <Section>
        {confirming ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-mid">Type {node.label} to delete it and its {links.length === 1 ? 'connection' : 'connections'}.</span>
              <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the name to confirm" />
            </label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                disabled={typed.trim() !== node.label}
                onClick={() => {
                  void deleteWebNode(node.id).then(onBack);
                }}
              >
                Delete for good
              </Button>
              <Button variant="text" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="text" onClick={() => setConfirming(true)}>
            Delete this node
          </Button>
        )}
      </Section>
    </div>
  );
}

function NodeLink({ node, onSelect }: { node: WebNode; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(node.id)} className="cursor-pointer border-0 bg-transparent p-0 text-walnut underline">
      {node.label}
    </button>
  );
}
