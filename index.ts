import axios, { AxiosHeaders } from 'axios';
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosStatic,
  CreateAxiosDefaults,
} from 'axios';

const DEFAULT_ERROR_MESSAGE = 'Request failed. Please try again later.';
const NOT_FOUND_ERROR_MESSAGE = 'Request URL not found.';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded;charset=UTF-8';

type MaybePromise<T> = T | Promise<T>;
type FormPayload = string | URLSearchParams;

export interface ExtendedAxiosRequestConfig<D = any> extends AxiosRequestConfig<D> {
  skipDefaultErrorHandler?: boolean;
}

export interface DefaultErrorHandlerContext {
  instance: AxiosInstance;
  config?: ExtendedAxiosRequestConfig;
  response?: AxiosResponse;
}

export type DefaultErrorHandler = (
  error: unknown,
  context: DefaultErrorHandlerContext,
) => MaybePromise<void>;

export interface ExtendedAxiosOptions {
  errorHandler?: DefaultErrorHandler | null;
}

export interface ExtendedAxiosRequestMethods {
  POSTJSON<T = any, D = any>(
    url: string,
    data?: D,
    config?: ExtendedAxiosRequestConfig<D>,
  ): Promise<T>;
  POSTFORM<T = any, D = any>(
    url: string,
    data?: D,
    config?: ExtendedAxiosRequestConfig<FormPayload>,
  ): Promise<T>;
  GET<T = any, P = any>(
    url: string,
    params?: P,
    config?: ExtendedAxiosRequestConfig,
  ): Promise<T>;
  PUT<T = any, D = any>(
    url: string,
    data?: D,
    config?: ExtendedAxiosRequestConfig<D>,
  ): Promise<T>;
  DELETE<T = any, P = any>(
    url: string,
    params?: P,
    config?: ExtendedAxiosRequestConfig,
  ): Promise<T>;
  PATCH<T = any, D = any>(
    url: string,
    data?: D,
    config?: ExtendedAxiosRequestConfig<D>,
  ): Promise<T>;
  DOWNLOAD<T = any, P = any>(
    url: string,
    params?: P,
    config?: ExtendedAxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  DOWNLOADPOST<T = any, D = any>(
    url: string,
    data?: D,
    config?: ExtendedAxiosRequestConfig<D>,
  ): Promise<AxiosResponse<T>>;
}

export interface ExtendedAxiosControlMethods {
  setDefaultErrorHandler(handler?: DefaultErrorHandler | null): this;
  setErrorHandle(handler?: DefaultErrorHandler | null): this;
  getDefaultErrorHandler(): DefaultErrorHandler | undefined;
  removeDefaultInterceptors(): this;
}

export interface ExtendedAxiosInstance
  extends AxiosInstance,
    ExtendedAxiosRequestMethods,
    ExtendedAxiosControlMethods {}

export interface ExtendedAxiosStatic
  extends AxiosStatic,
    ExtendedAxiosRequestMethods,
    ExtendedAxiosControlMethods {
  create(
    config?: CreateAxiosDefaults,
    options?: ExtendedAxiosOptions,
  ): ExtendedAxiosInstance;
}

interface InstanceState {
  errorHandler?: DefaultErrorHandler;
  requestInterceptorId?: number;
  responseInterceptorId?: number;
}

const instanceStateMap = new WeakMap<AxiosInstance, InstanceState>();

function getState(instance: AxiosInstance): InstanceState {
  const currentState = instanceStateMap.get(instance);

  if (currentState) {
    return currentState;
  }

  const nextState: InstanceState = {};
  instanceStateMap.set(instance, nextState);
  return nextState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getResponseMessage(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const message = data.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const msg = data.msg;
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }

  return undefined;
}

function normalizeError(error: unknown): unknown {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && !error.message) {
      error.message = DEFAULT_ERROR_MESSAGE;
    }

    return error;
  }

  const fallbackMessage = error.message || DEFAULT_ERROR_MESSAGE;
  const responseMessage = getResponseMessage(error.response?.data);

  if (!error.response) {
    error.message = fallbackMessage;
    return error;
  }

  if (error.response.status === 404) {
    error.message = responseMessage || NOT_FOUND_ERROR_MESSAGE;
    return error;
  }

  error.message = responseMessage || fallbackMessage || DEFAULT_ERROR_MESSAGE;
  return error;
}

function extractConfig(error: unknown): ExtendedAxiosRequestConfig | undefined {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  return error.config as ExtendedAxiosRequestConfig | undefined;
}

async function runDefaultErrorHandler(instance: AxiosInstance, error: unknown): Promise<unknown> {
  const normalizedError = normalizeError(error);
  const state = getState(instance);
  const handler = state.errorHandler;
  const config = extractConfig(normalizedError);

  if (!handler || config?.skipDefaultErrorHandler) {
    return normalizedError;
  }

  try {
    await handler(normalizedError, {
      instance,
      config,
      response: axios.isAxiosError(normalizedError) ? normalizedError.response : undefined,
    });
  } catch {
    return normalizedError;
  }

  return normalizedError;
}

function ensureDefaultInterceptors(instance: AxiosInstance): void {
  const state = getState(instance);

  if (state.requestInterceptorId !== undefined || state.responseInterceptorId !== undefined) {
    return;
  }

  state.requestInterceptorId = instance.interceptors.request.use(
    (config) => config,
    async (error) => Promise.reject(await runDefaultErrorHandler(instance, error)),
  );

  state.responseInterceptorId = instance.interceptors.response.use(
    (response) => response,
    async (error) => Promise.reject(await runDefaultErrorHandler(instance, error)),
  );
}

function removeDefaultInterceptors(instance: AxiosInstance): void {
  const state = getState(instance);

  if (state.requestInterceptorId !== undefined) {
    instance.interceptors.request.eject(state.requestInterceptorId);
    state.requestInterceptorId = undefined;
  }

  if (state.responseInterceptorId !== undefined) {
    instance.interceptors.response.eject(state.responseInterceptorId);
    state.responseInterceptorId = undefined;
  }
}

function setErrorHandler(
  instance: AxiosInstance,
  handler?: DefaultErrorHandler | null,
): void {
  getState(instance).errorHandler = handler ?? undefined;
}

function getDefaultDownloadResponseType(): NonNullable<AxiosRequestConfig['responseType']> {
  return typeof window === 'undefined' ? 'arraybuffer' : 'blob';
}

function getResponseData<T>(response: AxiosResponse): T {
  const responseData = response.data as T & { data?: T };
  return responseData?.data ?? (response.data as T);
}

function appendUrlEncodedValue(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendUrlEncodedValue(params, `${key}[${index}]`, item);
    });
    return;
  }

  if (value instanceof Date) {
    params.append(key, value.toISOString());
    return;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendUrlEncodedValue(params, `${key}[${childKey}]`, childValue);
    });
    return;
  }

  params.append(key, String(value));
}

function toUrlEncodedPayload(data: unknown): FormPayload | undefined {
  if (data === undefined || data === null) {
    return undefined;
  }

  if (typeof data === 'string' || data instanceof URLSearchParams) {
    return data;
  }

  if (!isRecord(data) && !Array.isArray(data)) {
    return String(data);
  }

  const params = new URLSearchParams();

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      appendUrlEncodedValue(params, String(index), item);
    });
    return params;
  }

  Object.entries(data).forEach(([key, value]) => {
    appendUrlEncodedValue(params, key, value);
  });

  return params;
}

function buildFormConfig(
  config?: ExtendedAxiosRequestConfig<FormPayload>,
): ExtendedAxiosRequestConfig<FormPayload> {
  const headers = AxiosHeaders.from(config?.headers as any);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', FORM_CONTENT_TYPE);
  }

  return {
    ...config,
    headers,
  };
}

function buildDownloadConfig<D = any>(
  config?: ExtendedAxiosRequestConfig<D>,
): ExtendedAxiosRequestConfig<D> {
  return {
    ...config,
    responseType: config?.responseType ?? getDefaultDownloadResponseType(),
  };
}

function createExtendedRequestMethods(instance: AxiosInstance): ExtendedAxiosRequestMethods {
  return {
    async POSTJSON<T = any, D = any>(
      url: string,
      data?: D,
      config?: ExtendedAxiosRequestConfig<D>,
    ): Promise<T> {
      const response = await instance.post(url, data, config);
      return getResponseData<T>(response);
    },

    async POSTFORM<T = any, D = any>(
      url: string,
      data?: D,
      config?: ExtendedAxiosRequestConfig<FormPayload>,
    ): Promise<T> {
      const response = await instance.post(
        url,
        toUrlEncodedPayload(data),
        buildFormConfig(config),
      );
      return getResponseData<T>(response);
    },

    async GET<T = any, P = any>(
      url: string,
      params?: P,
      config?: ExtendedAxiosRequestConfig,
    ): Promise<T> {
      const response = await instance.get(url, {
        ...config,
        params,
      });
      return getResponseData<T>(response);
    },

    async PUT<T = any, D = any>(
      url: string,
      data?: D,
      config?: ExtendedAxiosRequestConfig<D>,
    ): Promise<T> {
      const response = await instance.put(url, data, config);
      return getResponseData<T>(response);
    },

    async DELETE<T = any, P = any>(
      url: string,
      params?: P,
      config?: ExtendedAxiosRequestConfig,
    ): Promise<T> {
      const response = await instance.delete(url, {
        ...config,
        params,
      });
      return getResponseData<T>(response);
    },

    async PATCH<T = any, D = any>(
      url: string,
      data?: D,
      config?: ExtendedAxiosRequestConfig<D>,
    ): Promise<T> {
      const response = await instance.patch(url, data, config);
      return getResponseData<T>(response);
    },

    async DOWNLOAD<T = any, P = any>(
      url: string,
      params?: P,
      config?: ExtendedAxiosRequestConfig,
    ): Promise<AxiosResponse<T>> {
      return instance.get<T>(url, {
        ...buildDownloadConfig(config),
        params,
      });
    },

    async DOWNLOADPOST<T = any, D = any>(
      url: string,
      data?: D,
      config?: ExtendedAxiosRequestConfig<D>,
    ): Promise<AxiosResponse<T>> {
      return instance.post<T>(url, data, buildDownloadConfig(config));
    },
  };
}

function createExtendedControlMethods(
  instance: AxiosInstance,
): ExtendedAxiosControlMethods {
  return {
    setDefaultErrorHandler(handler?: DefaultErrorHandler | null) {
      setErrorHandler(instance, handler);
      return this;
    },

    setErrorHandle(handler?: DefaultErrorHandler | null) {
      setErrorHandler(instance, handler);
      return this;
    },

    getDefaultErrorHandler() {
      return getState(instance).errorHandler;
    },

    removeDefaultInterceptors() {
      removeDefaultInterceptors(instance);
      return this;
    },
  };
}

function enhanceAxiosInstance<T extends AxiosInstance>(
  instance: T,
  options?: ExtendedAxiosOptions,
): T & ExtendedAxiosInstance {
  ensureDefaultInterceptors(instance);

  if (options?.errorHandler !== undefined) {
    setErrorHandler(instance, options.errorHandler);
  }

  Object.assign(instance, createExtendedRequestMethods(instance));
  Object.assign(instance, createExtendedControlMethods(instance));

  return instance as T & ExtendedAxiosInstance;
}

const rawCreate = axios.create.bind(axios);

function create(
  config?: CreateAxiosDefaults,
  options?: ExtendedAxiosOptions,
): ExtendedAxiosInstance {
  const parentErrorHandler = getState(extendedAxios).errorHandler;

  return enhanceAxiosInstance(rawCreate(config), {
    errorHandler:
      options?.errorHandler !== undefined ? options.errorHandler : parentErrorHandler,
  });
}

const extendedAxios = enhanceAxiosInstance(axios, {});
extendedAxios.create = create;

export { create };
export * from 'axios';
export default extendedAxios as ExtendedAxiosStatic;
