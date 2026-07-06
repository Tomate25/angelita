// Custom mock base44 client to route requests to local REST API backend

async function apiRequest(method, path, body = null, headers = {}) {
  const token = localStorage.getItem('token');
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const config = {
    method,
    headers: { ...defaultHeaders, ...headers }
  };

  if (body) {
    if (body instanceof FormData) {
      delete config.headers['Content-Type'];
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
    }
  }

  const response = await fetch(path, config);
  
  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch (e) {
      // ignore JSON parse error
    }
    const err = new Error(errorData?.message || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.data = errorData;
    throw err;
  }

  return response.json();
}

const entityHandler = (entityName) => {
  return {
    list: async (sort, limit, skip) => {
      const params = new URLSearchParams();
      if (sort) params.append('sort', sort);
      if (limit) params.append('limit', limit);
      if (skip) params.append('skip', skip);
      const queryString = params.toString();
      const url = `/api/entities/${entityName}${queryString ? `?${queryString}` : ''}`;
      return apiRequest('GET', url);
    },
    get: async (id) => {
      return apiRequest('GET', `/api/entities/${entityName}/${id}`);
    },
    create: async (data) => {
      return apiRequest('POST', `/api/entities/${entityName}`, data);
    },
    update: async (id, data) => {
      return apiRequest('PUT', `/api/entities/${entityName}/${id}`, data);
    },
    delete: async (id) => {
      return apiRequest('DELETE', `/api/entities/${entityName}/${id}`);
    },
    filter: async (query) => {
      return apiRequest('POST', `/api/entities/${entityName}/filter`, query);
    }
  };
};

const entitiesProxy = new Proxy({}, {
  get: (target, entityName) => {
    return entityHandler(entityName);
  }
});

export const base44 = {
  entities: entitiesProxy,
  auth: {
    me: async () => {
      return apiRequest('GET', '/api/auth/me');
    },
    login: async (credentials) => {
      const data = await apiRequest('POST', '/api/auth/login', credentials);
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      return data;
    },
    logout: async () => {
      try {
        await apiRequest('POST', '/api/auth/logout');
      } catch (e) {
        console.error('Logout API failed, clearing local storage anyway', e);
      }
      localStorage.removeItem('token');
    },
    redirectToLogin: () => {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  },
  functions: {
    invoke: async (functionName, data) => {
      return apiRequest('POST', `/api/functions/${functionName}`, data);
    }
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiRequest('POST', '/api/integrations/Core/UploadFile', formData);
      },
      ExtractDataFromUploadedFile: async (data) => {
        return apiRequest('POST', '/api/integrations/Core/ExtractDataFromUploadedFile', data);
      }
    }
  }
};
