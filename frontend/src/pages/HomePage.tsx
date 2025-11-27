import { useQuery } from '@tanstack/react-query';
import { Card, List, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import api from '../utils/api';

function HomePage() {
  const { data } = useQuery({ queryKey: ['articles'], queryFn: async () => (await api.get('/articles')).data });

  return (
    <Card title="ÉçÇøÎÄÕÂ">
      <List
        dataSource={data || []}
        renderItem={(item: any) => (
          <List.Item actions={[<span key="likes">?? {item.likes_count}</span>]}> 
            <List.Item.Meta
              title={<Link to={`/articles/${item.id}`}>{item.title}</Link>}
              description={
                <div style={{ display: 'flex', gap: 8 }}>
                  {(item.tags || []).map((t: string) => <Tag key={t}>{t}</Tag>)}
                  <Typography.Text type="secondary">{new Date(item.created_at).toLocaleString()}</Typography.Text>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

export default HomePage;
