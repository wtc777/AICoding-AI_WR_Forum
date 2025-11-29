import { useEffect, useRef, useState } from 'react';
import { Card, Form, Input, Button, message, Space, List, Typography, Modal, Checkbox } from 'antd';
import { useNavigate } from 'react-router-dom';
import MarkdownPreview from '@uiw/react-markdown-preview';
import '@uiw/react-markdown-preview/markdown.css';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import CardSetBoard, { type CardSetHandle, type CardSetState } from '../components/CardSetBoard';
import useAuthStore from '../stores/auth';

function ParsePage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [responseText, setResponseText] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [useMockResult, setUseMockResult] = useState(false);
  const [form] = Form.useForm();
  const [cardSetState, setCardSetState] = useState<CardSetState | null>(null);
  const [boardRef] = useState<React.RefObject<CardSetHandle>>(() => ({ current: null } as React.RefObject<CardSetHandle>));
  const markdownRef = useRef<HTMLDivElement | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const scoreLabel = (score: number) => {
    if (score > 17) return '超级';
    if (score > 10 && score < 17) return '明显';
    return '一般';
  };

  const buildScoreText = (scores: Record<string, number>) =>
    `红 ${scores.red ?? 0}（${scoreLabel(scores.red ?? 0)}） | 蓝 ${scores.blue ?? 0}（${scoreLabel(
      scores.blue ?? 0,
    )}） | 黄 ${scores.yellow ?? 0}（${scoreLabel(scores.yellow ?? 0)}） | 绿 ${scores.green ?? 0}（${scoreLabel(
      scores.green ?? 0,
    )}）`;

  const cleanResponseText = (text: string | undefined | null) => {
    if (!text) return '';
    const raw = text.trim();
    const fenced = raw.match(/^```[a-zA-Z0-9]*\s+([\s\S]*?)\s*```$/);
    if (fenced && fenced[1]) {
      return fenced[1].trim();
    }
    if (!raw.startsWith('```')) return raw;
    const lines = raw.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith('```')) {
      lines.pop();
    }
    return lines.join('\n').trim();
  };

  const scoringRulePrompt =
    '计分规则：阵列为 3 行 4 列，从上到下、从左到右编号 1-12；每张卡牌的基础分是卡面 value，每行有额外加成：第一排每张 +2，第二排每张 +1，第三排不加分。四种颜色分别累计得到总分。';

  const normalizeLayout = (layout: CardSetState['layout'] | null | undefined) =>
    (layout || []).map((slot, idx) => {
      if (!slot) return null;
      const slotIndex = slot.slotIndex ?? idx;
      const row = slot.row ?? Math.floor(slotIndex / 4) + 1;
      const col = slot.col ?? (slotIndex % 4) + 1;
      const rowLabel = slot.rowLabel || (row === 1 ? '第一排' : row === 2 ? '第二排' : '第三排');
      const positionLabel = slot.positionLabel || `${rowLabel} 第${col}列`;
      return { ...slot, slotIndex, row, col, rowLabel, positionLabel };
    });

  const buildLayoutSummary = (layout: ReturnType<typeof normalizeLayout>) =>
    (layout || []).map((slot, idx) => {
      if (!slot) return `槽位 ${idx + 1}: 空`;
      const slotIndex = (slot.slotIndex ?? idx) + 1;
      const rowLabel = slot.rowLabel || (slot.row === 1 ? '第一排' : slot.row === 2 ? '第二排' : '第三排');
      const col = slot.col ?? ((slot.slotIndex ?? idx) % 4) + 1;
      const sideLabel = slot.side === 'front' ? '正面' : '反面';
      return `${rowLabel} 第${col}列（槽位 ${slotIndex}）：${slot.title}（${sideLabel}/${slot.color}，值 ${slot.value}）`;
    });

  const doSubmit = async (
    values: any,
    scoreText: string,
    normalizedLayout: ReturnType<typeof normalizeLayout>,
  ) => {
    const formData = new FormData();
    const layoutPayload = (normalizedLayout || []).map((slot, idx) => {
      if (!slot) return null;
      const row = slot.row ?? Math.floor(idx / 4) + 1;
      const col = slot.col ?? (idx % 4) + 1;
      const rowLabel = slot.rowLabel || (row === 1 ? '第一排' : row === 2 ? '第二排' : '第三排');
      const positionLabel = slot.positionLabel || `${rowLabel} 第${col}列`;
      return {
        title: slot.title,
        value: slot.value,
        color: slot.color,
        positionLabel,
      };
    });

    const payloadDebug = {
      card_type: values.card_type || '',
      scene_desc_len: (values.scene_desc || '').length,
      usedCount: cardSetState?.usedCount,
      complete: cardSetState?.complete,
      scoreText,
      layout: layoutPayload,
    };

    formData.append('card_type', values.card_type || '');
    formData.append('scene_desc', values.scene_desc || '');
    formData.append('cardset_layout', JSON.stringify(layoutPayload));
    formData.append('cardset_scores', JSON.stringify(cardSetState?.scores || {}));
    formData.append('cardset_score_text', scoreText);
    formData.append('cardset_score_logic', scoringRulePrompt);
    formData.append('cardset_used_count', String(cardSetState?.usedCount || 0));
    formData.append('cardset_complete', String(cardSetState?.complete));

    console.log('[parse submit] payload', payloadDebug);
    console.log('[parse submit] layout payload size', JSON.stringify(layoutPayload).length);

    const msgKey = 'parse-submit';
    message.loading({ content: '步骤1/3：生成布局图片...', key: msgKey, duration: 0 });

    try {
      setLoading(true);
      message.loading({ content: '步骤2/3：调用大模型...', key: msgKey, duration: 0 });
      console.log('[parse submit] calling backend /ai/card/interpret-with-image');
      const { data } = await api.post('/ai/card/interpret-with-image', formData);
      console.log('[parse submit] backend response received', {
        hasCards: !!data?.cards_json,
        aiResponseLen: (data?.ai_response || '').length,
      });
      message.loading({ content: '步骤3/3：等待返回结果...', key: msgKey, duration: 0 });

      setResult(data);
      setResponseText(cleanResponseText(data.ai_response || ''));
      message.success({ content: '解析完成', key: msgKey, duration: 2 });
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || '解析失败';
      if (err.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        logout();
        navigate('/login');
      } else {
        message.error(`解析失败：${detail}`);
      }
      message.destroy(msgKey);
      console.error('解析失败调试信息', {
        detail,
        status: err.response?.status,
        responseHeaders: err.response?.headers,
        responseData: err.response?.data,
      });
    } finally {
      setLoading(false);
    }
  };

  const onFinish = (values: any) => {
    if (useMockResult) {
      const mock = `# 示例解析结果

- 阵容亮点：红色情绪占主导，蓝色思考类补充，整体偏行动。
- 建议：注意情绪波动时的沟通节奏，保持条理性。

| 位置 | 卡牌 | 颜色 | 值 |
| --- | --- | --- | --- |
| 第一排 第1列 | 悲观 | 蓝 | 3 |
| 第一排 第2列 | 乐观 | 红 | 1 |
| 第一排 第3列 | 条理 | 蓝 | 1 |
| 第一排 第4列 | 批判性强 | 黄 | 3 |`;
      setResult({ ai_response: mock, cards_json: [] });
      setResponseText(cleanResponseText(mock));
      message.success('已生成示例解析结果');
      return;
    }

    if (!cardSetState?.complete) {
      message.warning('请先完成卡牌摆放再提交解析');
      return;
    }

    const normalizedLayout = normalizeLayout(cardSetState.layout);
    const layoutSummary = buildLayoutSummary(normalizedLayout);

    const scoreText =
      cardSetState.scoreText && !cardSetState.scoreText.includes('未计分')
        ? cardSetState.scoreText
        : buildScoreText(cardSetState.scores || {});

    Modal.confirm({
      title: '当前卡牌摆放明细与初步分数',
      width: 720,
      okText: '确认提交',
      cancelText: '取消',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>算牌结果：{scoreText}</Typography.Text>
          <Typography.Text type="secondary">已上阵 {cardSetState.usedCount}/12</Typography.Text>
          <List
            size="small"
            bordered
            dataSource={layoutSummary}
            renderItem={(item) => <List.Item>{item}</List.Item>}
            style={{ maxHeight: 320, overflow: 'auto' }}
          />
        </Space>
      ),
      onOk: () => doSubmit(values, scoreText, normalizedLayout),
    });
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const uploadImage = async (blob: Blob) => {
    const fd = new FormData();
    fd.append('file', blob, 'cardset.png');
    const token = useAuthStore.getState().accessToken;
    const { data } = await api.post('/ai/upload', fd, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return data.url as string;
  };

  const exportResultImage = async () => {
    if (!resultCardRef.current) {
      message.info('暂无可导出的解析卡片');
      return;
    }
    if (!boardRef.current?.captureImage) {
      message.info('当前无可导出的布局图片');
      return;
    }
    try {
      setExporting(true);
      const layoutBlob = await boardRef.current.captureImage();
      const layoutDataUrl = await blobToDataUrl(layoutBlob);

      const resultCanvas = await html2canvas(resultCardRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const resultDataUrl = resultCanvas.toDataURL('image/png');

      const layoutImg = new Image();
      const resultImg = new Image();
      const imagesReady = [
        new Promise<void>((resolve, reject) => {
          layoutImg.onload = () => resolve();
          layoutImg.onerror = reject;
          layoutImg.src = layoutDataUrl;
        }),
        new Promise<void>((resolve, reject) => {
          resultImg.onload = () => resolve();
          resultImg.onerror = reject;
          resultImg.src = resultDataUrl;
        }),
      ];
      await Promise.all(imagesReady);

      const maxWidth = Math.max(layoutImg.width, resultImg.width);
      const gap = 24;
      const totalHeight = layoutImg.height + gap + resultImg.height;

      const mergeCanvas = document.createElement('canvas');
      mergeCanvas.width = maxWidth;
      mergeCanvas.height = totalHeight;
      const ctx = mergeCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建画布');
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, mergeCanvas.width, mergeCanvas.height);
      ctx.drawImage(layoutImg, 0, 0);
      ctx.drawImage(resultImg, 0, layoutImg.height + gap);

      const mergedDataUrl = mergeCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = mergedDataUrl;
      link.download = 'cardset-analysis.png';
      link.click();
      message.success('已导出解析结果图片');
    } catch (err: any) {
      message.error(err?.message || '导出解析图片失败');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (!boardRef.current?.captureImage) {
      message.info('当前无可导出的布局图片');
      return;
    }
    try {
      setExporting(true);
      const blob = await boardRef.current.captureImage();
      const dataUrl = await blobToDataUrl(blob);
      let mdDataUrl: string | null = null;
      if (markdownRef.current) {
        try {
          const canvas = await html2canvas(markdownRef.current, { scale: 2, backgroundColor: '#ffffff' });
          mdDataUrl = canvas.toDataURL('image/png');
        } catch (err) {
          console.error('markdown capture failed, fallback to plain text', err);
        }
      }

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 32;
      const usableWidth = pageWidth - margin * 2;
      let y = margin;

      const imgProps = doc.getImageProperties(dataUrl);
      const imgHeight = (imgProps.height * usableWidth) / imgProps.width;
      doc.addImage(dataUrl, 'PNG', margin, y, usableWidth, imgHeight);
      y += imgHeight + 16;

      doc.setFontSize(14);
      doc.text('解析结果', margin, y);
      y += 14;
      doc.setFontSize(11);

      if (mdDataUrl) {
        const mdProps = doc.getImageProperties(mdDataUrl);
        const mdHeight = (mdProps.height * usableWidth) / mdProps.width;
        doc.addImage(mdDataUrl, 'PNG', margin, y, usableWidth, mdHeight);
        y += mdHeight;
      } else {
        const analysis = responseText || result?.ai_response || '';
        const lines = doc.splitTextToSize(analysis, usableWidth);
        doc.text(lines, margin, y);
      }

      doc.save('cardset-analysis.pdf');
      message.success('已导出 PDF');
    } catch (err: any) {
      console.error('导出 PDF 失败', err);
      message.error(err?.message || '导出 PDF 失败');
    } finally {
      setExporting(false);
    }
  };

  const archiveArticle = async () => {
    const values = form.getFieldsValue();
    const sceneDesc = values.scene_desc || '';
    const cardType = values.card_type || '未命名卡组';
    if (!user) {
      message.warning('请先登录后再归档');
      navigate('/login');
      return;
    }
    if (!responseText) {
      message.warning('暂无解析结果可归档');
      return;
    }
    if (!boardRef.current?.captureImage) {
      message.warning('当前无可导出的牌阵图片');
      return;
    }
    try {
      setArchiving(true);
      const blob = await boardRef.current.captureImage();
      const coverUrl = await uploadImage(blob);
      const markdown = `![牌阵封面](${coverUrl})\n\n> 摘要：${sceneDesc || '未提供'}\n\n${responseText}`;
      const tagNames = Array.from(
        new Set(
          [cardType, '卡牌档案', '卡牌', '性格色彩', '解析']
            .map((t) => (t || '').trim())
            .filter((t) => t && !/^\d+$/.test(t)),
        ),
      );
      const title = `卡牌解析 - ${cardType}`;

      const token = useAuthStore.getState().accessToken;
      const { data } = await api.post(
        '/articles',
        {
          title,
          content_markdown: markdown,
          is_published: false,
          is_auto_generated: true,
          tag_names: tagNames,
          from_reading_id: result?.id || null,
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      message.success(`已归档为文章 #${data.id}`);
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error('登录已过期，请重新登录后再归档');
        logout();
        navigate('/login');
      } else {
        message.error(err?.response?.data?.detail || err?.message || '归档失败');
      }
      console.error('archive failed', err);
    } finally {
      setArchiving(false);
    }
  };

  useEffect(() => {
    if (result) {
      setResponseText(cleanResponseText(result.ai_response || ''));
    }
  }, [result]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="卡组摆放（支持拖拽、切换正反面、计算得分）" bordered>
        <CardSetBoard ref={boardRef} parsedCards={result?.cards_json} onStateChange={setCardSetState} />
      </Card>

      <Card title="卡牌解析" bordered>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="卡组类型" name="card_type">
            <Input />
          </Form.Item>
          <Form.Item label="场景描述" name="scene_desc" rules={[{ required: true, message: '请输入场景描述' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Checkbox checked={useMockResult} onChange={(e) => setUseMockResult(e.target.checked)}>
              仅生成示例解析结果（跳过模型调用）
            </Checkbox>
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              提交解析
            </Button>
            <Button onClick={archiveArticle} loading={archiving} disabled={!responseText}>
              卡牌归档
            </Button>
          </Space>
        </Form>
      </Card>

      {result && (
        <Card
          title="解析结果"
          extra={
            <Space>
              <Button size="small" onClick={exportResultImage} loading={exporting}>
                导出解析图片
              </Button>
              <Button size="small" type="primary" onClick={exportPdf} loading={exporting}>
                导出 PDF
              </Button>
              <Button size="small" onClick={() => setShowEditor((v) => !v)}>
                {showEditor ? '隐藏编辑' : '显示编辑'}
              </Button>
            </Space>
          }
        >
          <div ref={resultCardRef}>
            {showEditor && (
              <Form layout="vertical">
                <Form.Item label="解析结果（可编辑测试 Markdown）">
                  <Input.TextArea
                    rows={6}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="在此粘贴或编辑 Markdown 内容"
                  />
                </Form.Item>
              </Form>
            )}
            <div data-color-mode="light" ref={markdownRef} style={{ background: '#fff', padding: 12 }}>
              <MarkdownPreview key={responseText || 'empty'} source={responseText || '暂无解析内容'} />
            </div>
          </div>
          <List
            header="识别到的卡牌"
            dataSource={result.cards_json || []}
            renderItem={(c: any) => (
              <List.Item>
                <Space>
                  <span>{c.name}</span>
                  {c.code && <span>#{c.code}</span>}
                  {c.position && <span>位置: {c.position}</span>}
                  {c.confidence && <span>置信度: {c.confidence}</span>}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </Space>
  );
}

export default ParsePage;
