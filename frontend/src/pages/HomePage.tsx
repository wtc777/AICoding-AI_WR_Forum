import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Tag, Space, Typography } from 'antd';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 10px 26px rgba(15,23,42,0.12)',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e2e8f0',
  },
  cover: { height: 180, objectFit: 'cover', width: '100%', background: '#e2e8f0' },
  body: { padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  meta: { display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12 },
  badge: { fontSize: 11, color: '#475569' },
};

function HomePage() {
  const { data } = useQuery({ queryKey: ['articles-community'], queryFn: async () => (await api.get('/articles', { params: { scope: 'community' } })).data });
  const navigate = useNavigate();

  const articles = useMemo(() => data || [], [data]);

  const extractSummary = (md: string) => {
    if (!md) return '暂无摘要';
    const match = md.match(/^>\s*摘要：(.+)$/m);
    if (match && match[1]) return match[1].trim();
    return md.replace(/\n+/g, ' ').slice(0, 80) || '暂无摘要';
  };

  const formatTime = (val: string) => {
    if (!val) return '';
    const ts = val.endsWith('Z') ? val : `${val}Z`;
    return new Date(ts).toLocaleString();
  };

  return (
    <div style={styles.page}>
      <Typography.Title level={4}>社区文章</Typography.Title>
      <div style={styles.grid}>
        {articles.map((item: any) => {
          const coverMatch = item.content_markdown?.match(/!\[[^\]]*\]\(([^)]+)\)/);
          const cover = coverMatch ? coverMatch[1] : null;
          return (
            <article key={item.id} style={styles.card}>
              {cover ? <img src={cover} alt={item.title} style={styles.cover} /> : <div style={styles.cover} />}
              <div style={{ padding: '10px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={styles.badge}>ID: {item.id}</span>
                <span style={styles.badge}>{item.author_name || '未知作者'}</span>
              </div>
              <div style={styles.body}>
                <Space size={6} wrap>
                  {(item.tags || []).map((t: string) => (
                    <Tag key={t} color="blue">{t}</Tag>
                  ))}
                </Space>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {item.title}
                </Typography.Title>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                  {extractSummary(item.content_markdown || '')}
                </Typography.Paragraph>
                <div style={styles.meta}>
                  <span>{formatTime(item.created_at)}</span>
                  <Button type="link" size="small" onClick={() => navigate(`/articles/${item.id}`)}>
                    查看详情
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
        {articles.length === 0 && <Card bordered style={{ textAlign: 'center' }}>暂无文章</Card>}
      </div>
    </div>
  );
}

export default HomePage;
