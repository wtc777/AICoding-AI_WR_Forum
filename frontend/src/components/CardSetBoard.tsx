import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { DragEvent, ForwardedRef } from 'react';
import { Button, Space, message, Tag } from 'antd';
import { ReloadOutlined, CalculatorOutlined, ExportOutlined, InboxOutlined } from '@ant-design/icons';
import './CardSetBoard.css';

type CardColor = 'red' | 'blue' | 'yellow' | 'green';
type CardSide = 'front' | 'back';

interface CardFace {
  title: string;
  english: string;
  value: number;
  color: CardColor;
  image: string;
}

interface CardDefinition {
  id: string;
  front: Omit<CardFace, 'image'>;
  back: Omit<CardFace, 'image'>;
}

export interface ParsedCardItem {
  name?: string;
  title?: string;
  code?: string;
  position?: number | string;
  side?: CardSide;
}

type SlotCard = CardFace & { cardId: string; side: CardSide; slotIndex: number };
type DragPayload = { type: 'deck'; card: SlotCard } | { type: 'slot'; index: number };

export interface CardSetState {
  layout: Array<
    | {
        cardId: string;
        side: CardSide;
        title: string;
        english: string;
        value: number;
        color: CardColor;
        slotIndex: number;
      }
    | null
  >;
  scores: Record<CardColor, number>;
  scoreText: string;
  complete: boolean;
  usedCount: number;
}

interface CardSetBoardProps {
  parsedCards?: ParsedCardItem[];
  onStateChange?: (state: CardSetState) => void;
}

export interface CardSetHandle {
  captureImage: () => Promise<Blob>;
}

const cards: CardDefinition[] = [
  {
    id: 'card_01',
    front: { title: '悲观', english: 'Frustrated', value: 3, color: 'blue' },
    back: { title: '乐观', english: 'Optimistic', value: 1, color: 'red' },
  },
  {
    id: 'card_02',
    front: { title: '他人认可最重要', english: 'Humans are the most important', value: 2, color: 'red' },
    back: { title: '事情结果最重要', english: 'Result is the most important', value: 2, color: 'yellow' },
  },
  {
    id: 'card_03',
    front: { title: '主动帮助他人', english: 'Always trying to help others', value: 2, color: 'red' },
    back: { title: '静待问题过去', english: 'Waiting for things to go away', value: 2, color: 'green' },
  },
  {
    id: 'card_04',
    front: { title: '条理', english: 'Organized', value: 1, color: 'blue' },
    back: { title: '随意', english: 'Random', value: 3, color: 'red' },
  },
  {
    id: 'card_05',
    front: { title: '以他人为中心', english: 'Others-centered', value: 1, color: 'green' },
    back: { title: '以自我为中心', english: 'Self-centered', value: 3, color: 'yellow' },
  },
  {
    id: 'card_06',
    front: { title: '越挫越勇', english: "What doesn't kill one makes one stronger", value: 1, color: 'yellow' },
    back: { title: '逆来顺受', english: 'Conservative and hold back', value: 3, color: 'green' },
  },
  {
    id: 'card_07',
    front: { title: '目标坚定', english: 'Determined', value: 1, color: 'yellow' },
    back: { title: '缺乏主见', english: 'Hold back', value: 3, color: 'green' },
  },
  {
    id: 'card_08',
    front: { title: '批判性强', english: 'Critical', value: 3, color: 'yellow' },
    back: { title: '平和宽容', english: 'Peaceful and tolerant', value: 1, color: 'green' },
  },
  {
    id: 'card_09',
    front: { title: '发现问题先研究', english: 'Study first when there is a problem', value: 2, color: 'blue' },
    back: { title: '发现问题先解决', english: 'Act immediately once there is a problem', value: 2, color: 'yellow' },
  },
  {
    id: 'card_10',
    front: { title: '情绪化', english: 'Emotional', value: 3, color: 'red' },
    back: { title: '自律', english: 'Self-discipline', value: 1, color: 'blue' },
  },
  {
    id: 'card_11',
    front: { title: '内心保守', english: 'Conservative', value: 3, color: 'blue' },
    back: { title: '乐于分享', english: 'Enjoy sharing', value: 1, color: 'red' },
  },
  {
    id: 'card_12',
    front: { title: '相安无事最重要', english: 'Waiting for things to go away', value: 2, color: 'green' },
    back: { title: '坚持原则最重要', english: 'Sticking to the principles is the most important', value: 2, color: 'blue' },
  },
];

const imageBase = '/cardset';
const emptySlots = () => Array<SlotCard | null>(12).fill(null);
const initialDeckFace = cards.reduce<Record<string, CardSide>>((acc, card) => {
  acc[card.id] = 'front';
  return acc;
}, {});

const slotScoreLabel = (score: number) => {
  if (score > 17) return '超级';
  if (score > 10 && score < 17) return '明显';
  return '一般';
};

const scoreLine = (scores: Record<CardColor, number>) =>
  `红: ${scores.red}（${slotScoreLabel(scores.red)}） | 蓝: ${scores.blue}（${slotScoreLabel(scores.blue)}） | 黄: ${scores.yellow}（${slotScoreLabel(scores.yellow)}） | 绿: ${scores.green}（${slotScoreLabel(scores.green)}）`;

const getFace = (card: CardDefinition, side: CardSide): CardFace => {
  const face = card[side];
  return {
    ...face,
    image: `${imageBase}/${encodeURIComponent(face.title)}.png`,
  };
};

const parsePosition = (position: number | string | undefined): number | null => {
  if (position === undefined || position === null) return null;
  const parsed = typeof position === 'number' ? position : parseInt(position, 10);
  if (!Number.isFinite(parsed)) return null;
  const idx = parsed - 1;
  return idx >= 0 && idx < 12 ? idx : null;
};

const matchCardByName = (name?: string) => {
  if (!name) return null;
  const target = name.trim();
  const matchFront = cards.find((c) => c.front.title === target || c.front.english === target || c.id === target);
  if (matchFront) return { card: matchFront, side: 'front' as CardSide };
  const matchBack = cards.find((c) => c.back.title === target || c.back.english === target);
  if (matchBack) return { card: matchBack, side: 'back' as CardSide };
  return null;
};

const cardMap = cards.reduce<Record<string, CardDefinition>>((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {});

function CardSetBoardBase({ parsedCards, onStateChange }: CardSetBoardProps, ref: ForwardedRef<CardSetHandle>) {
  const [slots, setSlots] = useState<(SlotCard | null)[]>(() => emptySlots());
  const [used, setUsed] = useState<Set<string>>(() => new Set());
  const [deckFace, setDeckFace] = useState<Record<string, CardSide>>(() => ({ ...initialDeckFace }));
  const [scoreText, setScoreText] = useState('当前未计分，点击“计算得分”查看阵容得分。');
  const dragPayload = useRef<DragPayload | null>(null);

  const usedCount = useMemo(() => slots.filter(Boolean).length, [slots]);
  const unusedCards = useMemo(() => cards.filter((c) => !used.has(c.id)), [used]);

  const calculateScores = (currentSlots: (SlotCard | null)[]) => {
    const scores: Record<CardColor, number> = { red: 0, blue: 0, yellow: 0, green: 0 };
    currentSlots.forEach((slot, idx) => {
      if (!slot) return;
      const row = Math.floor(idx / 4);
      const bonus = row === 0 ? 2 : row === 1 ? 1 : 0;
      scores[slot.color] += Number(slot.value || 0) + bonus;
    });
    return scores;
  };
  const currentScores = useMemo(() => calculateScores(slots), [slots]);

  useEffect(() => {
    if (!onStateChange) return;
    const layout = slots.map((slot, idx) =>
      slot
        ? {
            cardId: slot.cardId,
            side: slot.side,
            title: slot.title,
            english: slot.english,
            value: slot.value,
            color: slot.color,
            slotIndex: idx,
          }
        : null,
    );
    onStateChange({
      layout,
      scores: currentScores,
      scoreText,
      complete: layout.every(Boolean),
      usedCount,
    });
  }, [slots, currentScores, scoreText, onStateChange, usedCount]);

  const handleReset = () => {
    setSlots(emptySlots());
    setUsed(new Set());
    setDeckFace({ ...initialDeckFace });
    setScoreText('当前未计分，点击“计算得分”查看阵容得分。');
  };

  const handleCalc = () => {
    const scores = calculateScores(slots);
    setScoreText(scoreLine(scores));
  };

  const handleExport = () => {
    const layout = slots.map((slot, idx) =>
      slot
        ? {
            cardId: slot.cardId,
            side: slot.side,
            title: slot.title,
            english: slot.english,
            value: slot.value,
            color: slot.color,
            slotIndex: idx,
          }
        : null,
    );
    // eslint-disable-next-line no-console
    console.log('当前卡组摆放：', layout);
    message.success('已将当前摆放输出到控制台');
  };

  const captureImage = async () => {
    const cols = 4;
    const rows = 3;
    const slotW = 240;
    const slotH = 300;
    const padding = 20;
    const canvas = document.createElement('canvas');
    canvas.width = cols * slotW + padding * 2 + (cols - 1) * 14;
    canvas.height = rows * slotH + padding * 2 + (rows - 1) * 14 + 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      message.error('导出失败：无法创建画布');
      return;
    }
    // 背景
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 18px Segoe UI';
    ctx.fillText('卡组摆放', padding, padding + 12);

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    for (let i = 0; i < rows * cols; i++) {
      const slot = slots[i];
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = padding + col * (slotW + 14);
      const y = padding + 24 + row * (slotH + 14);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.setLineDash(slot ? [] : [8, 8]);
      ctx.strokeRect(x, y, slotW, slotH);
      ctx.setLineDash([]);

      if (slot) {
        if (slot.image) {
          try {
            const img = await loadImage(slot.image);
            const ratio = Math.min(slotW / img.width, slotH / img.height);
            const w = img.width * ratio;
            const h = img.height * ratio;
            const dx = x + (slotW - w) / 2;
            const dy = y + (slotH - h) / 2;
            ctx.drawImage(img, dx, dy, w, h);
          } catch (err) {
            ctx.fillStyle = colorTone[slot.color] || '#fff';
            ctx.fillRect(x, y, slotW, slotH);
            ctx.fillStyle = '#111827';
            ctx.font = '16px Segoe UI';
            ctx.fillText(slot.title, x + 12, y + 28);
          }
        } else {
          ctx.fillStyle = colorTone[slot.color] || '#fff';
          ctx.fillRect(x, y, slotW, slotH);
          ctx.fillStyle = '#111827';
          ctx.font = '16px Segoe UI';
          ctx.fillText(slot.title, x + 12, y + 28);
        }
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Segoe UI';
        ctx.fillText('空位', x + slotW / 2 - 16, y + slotH / 2);
      }
    }

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('生成图片失败'));
      }, 'image/png');
    });
  };

  async function exportAsImage() {
    try {
      const blob = await captureImage();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'cardset.png';
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      message.success('已导出当前摆放为图片');
    } catch (err: any) {
      message.error(err?.message || '导出失败');
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      captureImage,
    }),
    [slots],
  );

  const toggleDeckFace = (cardId: string) => {
    if (used.has(cardId)) return;
    setDeckFace((prev) => ({
      ...prev,
      [cardId]: prev[cardId] === 'front' ? 'back' : 'front',
    }));
  };

  const handleDeckDragStart = (card: CardDefinition) => (event: DragEvent<HTMLDivElement>) => {
    if (used.has(card.id)) return;
    const side = deckFace[card.id];
    const face = getFace(card, side);
    dragPayload.current = {
      type: 'deck',
      card: { ...face, cardId: card.id, side, slotIndex: -1 },
    };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', 'deck');
    requestAnimationFrame(() => {
      event.currentTarget.classList.add('dragging');
    });
  };

  const handleSlotDragStart = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    const slot = slots[index];
    if (!slot) return;
    dragPayload.current = { type: 'slot', index };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'slot');
    requestAnimationFrame(() => {
      event.currentTarget.classList.add('dragging');
    });
  };

  const clearDrag = (event: DragEvent<HTMLDivElement>) => {
    dragPayload.current = null;
    event.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.cardset-slot').forEach((slot) => slot.classList.remove('hovered'));
  };

  const handleDragOver = (targetIdx: number) => (event: DragEvent<HTMLDivElement>) => {
    if (!dragPayload.current) return;
    if (dragPayload.current.type === 'deck' && slots[targetIdx]) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = dragPayload.current.type === 'deck' ? 'copy' : 'move';
    event.currentTarget.classList.add('hovered');
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove('hovered');
  };

  const handleDrop = (targetIdx: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove('hovered');
    const payload = dragPayload.current;
    if (!payload) return;

    if (payload.type === 'slot') {
      if (payload.index === targetIdx) return;
      setSlots((prev) => {
        const next = [...prev];
        const sourceCard = next[payload.index];
        const targetCard = next[targetIdx];
        next[targetIdx] = sourceCard ? { ...sourceCard, slotIndex: targetIdx } : null;
        next[payload.index] = targetCard ? { ...targetCard, slotIndex: payload.index } : null;
        return next;
      });
    } else if (payload.type === 'deck') {
      if (slots[targetIdx]) return;
      const card = payload.card;
      setSlots((prev) => {
        const next = [...prev];
        next[targetIdx] = { ...card, slotIndex: targetIdx };
        return next;
      });
      setUsed((prev) => new Set([...prev, card.cardId]));
    }
  };

  const handleSlotClick = (idx: number) => {
    const slot = slots[idx];
    if (!slot) return;
    const cardDef = cardMap[slot.cardId];
    const nextSide: CardSide = slot.side === 'front' ? 'back' : 'front';
    const face = getFace(cardDef, nextSide);
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = {
        ...slot,
        side: nextSide,
        title: face.title,
        english: face.english,
        value: face.value,
        color: face.color,
        image: face.image,
      };
      return next;
    });
  };

  const handleImportFromParsed = () => {
    if (!parsedCards || parsedCards.length === 0) {
      message.info('没有可导入的解析结果');
      return;
    }

    const nextSlots = emptySlots();
    const nextUsed = new Set<string>();
    const nextDeckFace = { ...initialDeckFace };

    parsedCards.forEach((item) => {
      const match = matchCardByName(item.title || item.name || item.code);
      if (!match) return;
      const slotIdx = parsePosition(item.position) ?? nextSlots.findIndex((slot) => slot === null);
      if (slotIdx === -1 || slotIdx === null) return;
      const chosenSide: CardSide = item.side === 'back' ? 'back' : match.side;
      const face = getFace(match.card, chosenSide);
      nextSlots[slotIdx] = {
        ...face,
        cardId: match.card.id,
        side: chosenSide,
        slotIndex: slotIdx,
      };
      nextUsed.add(match.card.id);
      nextDeckFace[match.card.id] = chosenSide;
    });

    setSlots(nextSlots);
    setUsed(nextUsed);
    setDeckFace(nextDeckFace);
    setScoreText('已根据解析结果导入卡牌，可继续调整。');
  };

  return (
    <div className="cardset-wrapper">
      <aside className="cardset-deck">
        <div className="cardset-deck-header">
          <div>
            <div className="cardset-title">卡组（点击切换正反）</div>
            <div className="cardset-subtitle">左侧卡组拖拽到右侧阵型，已使用的卡牌会自动隐藏</div>
          </div>
          <Tag color="blue">{usedCount}/12 已上阵</Tag>
        </div>
        <div className="cardset-deck-list">
          {unusedCards.map((card) => {
            const side = deckFace[card.id];
            const face = getFace(card, side);
            return (
              <div
                key={card.id}
                className="cardset-deck-card"
                draggable
                onClick={() => toggleDeckFace(card.id)}
                onDragStart={handleDeckDragStart(card)}
                onDragEnd={clearDrag}
              >
                <span className="deck-side">{side === 'front' ? '正' : '反'}</span>
                <img className="deck-img" src={face.image} alt={face.title} />
              </div>
            );
          })}
          {unusedCards.length === 0 && <div className="cardset-empty">所有卡牌都已放置</div>}
        </div>
      </aside>

      <section className="cardset-board">
        <div className="cardset-toolbar">
          <Space>
            <Button icon={<CalculatorOutlined />} onClick={handleCalc}>
              计算得分
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
            <Button icon={<ExportOutlined />} onClick={exportAsImage}>
              导出布局图片
            </Button>
          </Space>
          <Space>
            <Button icon={<InboxOutlined />} onClick={handleImportFromParsed} disabled={!parsedCards || parsedCards.length === 0}>
              导入解析结果
            </Button>
          </Space>
        </div>

        <div className="cardset-slot-grid">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className={`cardset-slot${slot ? ' filled' : ''}`}
              onDragOver={handleDragOver(idx)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(idx)}
              onClick={() => handleSlotClick(idx)}
            >
              {slot ? (
                <div
                  className={`cardset-card${slot.image ? ' image-only' : ''}`}
                  draggable
                  onDragStart={handleSlotDragStart(idx)}
                  onDragEnd={clearDrag}
                >
                  {slot.image ? <img className="slot-img" src={slot.image} alt={slot.title} /> : null}
                </div>
              ) : (
                <span className="cardset-placeholder">空位</span>
              )}
            </div>
          ))}
        </div>

        <div className="cardset-instructions">
          <div>操作提示：</div>
          <ol>
            <li>点击卡组图片切换正反面，拖拽到右侧空位完成摆放。</li>
            <li>已放置的卡牌可以拖拽互换位置，点击可在正反面之间切换。</li>
            <li>根据行数存在额外加成：第一行 +2，第二行 +1，第三行无加成。</li>
          </ol>
        </div>

        <div className="cardset-score">{scoreText}</div>
      </section>
    </div>
  );
}

const CardSetBoard = forwardRef<CardSetHandle, CardSetBoardProps>(CardSetBoardBase);

export default CardSetBoard;
