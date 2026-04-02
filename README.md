# @xing.wu/axios

基于 `axios@1.14.0` 的增强封装。

特点：

- `axios` 作为本库正式依赖，使用方只需要安装本库。
- 默认导出保留 `axios` 原生 API，包含 `axios(...)`、`get/post`、`interceptors`、`create` 等。
- 额外挂载 `POSTJSON`、`POSTFORM`、`GET`、`PUT`、`DELETE`、`PATCH`、`DOWNLOAD`、`DOWNLOADPOST`。
- `create()` 返回的实例同样具备这些增强方法。
- 内置默认错误标准化处理，并支持外部注入统一错误处理函数。
- 打包同时输出 ESM、CJS、类型声明，适用于 Node 和 Web bundler。

## 安装

```bash
pnpm add @xing.wu/axios
```

## 基本使用

```ts
import request from '@xing.wu/axios';

const user = await request.GET<{ id: string; name: string }>('/api/user', {
  id: '1',
});

const saved = await request.POSTJSON('/api/user', {
  name: 'Xing',
});
```

## 保留 axios 原生能力

```ts
import request from '@xing.wu/axios';

const response = await request.get('/api/user');

const client = request.create({
  baseURL: 'https://example.com',
  timeout: 5000,
});

await client.POSTFORM('/login', {
  username: 'demo',
  password: '123456',
});
```

## 默认错误处理

本库默认会做两件事：

1. 标准化 `AxiosError.message`，优先读取后端返回的 `message` 或 `msg`。
2. 如果外部注册了默认错误处理器，则在请求失败时调用。

### 给默认实例注册错误处理器

```ts
import request from '@xing.wu/axios';

request.setDefaultErrorHandler((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
});
```

### 给 create 出来的实例单独注册

```ts
import request from '@xing.wu/axios';

const client = request.create(
  { baseURL: 'https://example.com' },
  {
    errorHandler(error) {
      console.error('client error:', error);
    },
  },
);
```

### 关闭默认拦截器

```ts
import request from '@xing.wu/axios';

request.removeDefaultInterceptors();
```

### 单次请求跳过默认错误处理器

```ts
import request from '@xing.wu/axios';

await request.GET('/api/user', { id: '1' }, { skipDefaultErrorHandler: true });
```

## 增强方法说明

### `POSTJSON`

`POSTJSON(url, data, config)`，返回 `response.data?.data ?? response.data`

### `POSTFORM`

`POSTFORM(url, data, config)`，按 `application/x-www-form-urlencoded` 提交，返回 `response.data?.data ?? response.data`

### `GET`

`GET(url, params, config)`，返回 `response.data?.data ?? response.data`

### `PUT`

`PUT(url, data, config)`，返回 `response.data?.data ?? response.data`

### `DELETE`

`DELETE(url, params, config)`，返回 `response.data?.data ?? response.data`

### `PATCH`

`PATCH(url, data, config)`，返回 `response.data?.data ?? response.data`

### `DOWNLOAD`

`DOWNLOAD(url, params, config)`，默认浏览器下使用 `blob`，Node 下使用 `arraybuffer`，返回完整 `AxiosResponse`

### `DOWNLOADPOST`

`DOWNLOADPOST(url, data, config)`，默认浏览器下使用 `blob`，Node 下使用 `arraybuffer`，返回完整 `AxiosResponse`

## 构建

```bash
pnpm install
pnpm build
```

构建后产物位于 `dist/`：

- `dist/index.js`
- `dist/index.cjs`
- `dist/index.d.ts`
