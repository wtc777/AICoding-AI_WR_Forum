import { useQuery } from '@tanstack/react-query';
import { Card, List, Typography } from 'antd';
import api from '../utils/api';

function ReadingsPage() {
  const { data } = useQuery({ queryKey: ['readings'], queryFn: async () => (await api.get('/ai/readings/my')).data });

  return (
    <Card title="解析档案">
      <List
        dataSource={data || []}
        renderItem={(item: any) => (
          <List.Item>
            <List.Item.Meta
              title={item.card_type || '卡牌解析'}
              description={<Typography.Text type="secondary">{item.scene_desc}</Typography.Text>}
            />
            <div>{new Date(item.created_at).toLocaleString()}</div>
          </List.Item>
        )}
      />
    </Card>
  );
}

export default ReadingsPage;
