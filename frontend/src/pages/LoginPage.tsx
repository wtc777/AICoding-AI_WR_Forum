import { Card, Form, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import useAuthStore from '../stores/auth';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const onFinish = async (values: any) => {
    try {
      const { data } = await api.post('/auth/login', values);
      const me = await api.get('/auth/me', { headers: { Authorization: `Bearer ${data.access_token}` } });
      login({ user: me.data, access: data.access_token, refresh: data.refresh_token });
      message.success('登录成功');
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.detail || '登录失败');
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <Card title="登录">
        <Form
          layout="vertical"
          onFinish={onFinish}
          onFinishFailed={({ errorFields }) => {
            if (errorFields.length) {
              message.warning(errorFields[0].errors[0] || '请检查输入');
            }
          }}
        >
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
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>登录</Button>
        </Form>
      </Card>
    </div>
  );
}

export default LoginPage;

