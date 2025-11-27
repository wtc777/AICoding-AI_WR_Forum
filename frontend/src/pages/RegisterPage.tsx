import { Card, Form, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function RegisterPage() {
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    try {
      await api.post('/auth/register', values);
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (err: any) {
      message.error(err.response?.data?.detail || '注册失败');
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <Card title="注册">
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item label="昵称" name="nickname"> <Input /> </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '至少 6 位字符' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>注册</Button>
        </Form>
      </Card>
    </div>
  );
}

export default RegisterPage;
