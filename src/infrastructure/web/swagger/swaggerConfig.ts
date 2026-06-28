import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Oficina Marimb0ndo API',
      version: '1.0.0',
      description:
        'API REST para gerenciamento de oficina mecânica — FIAP Tech Challenge Phase 1 & 2',
      contact: {
        name: 'Oficina Marimb0ndo',
        email: 'contato@oficina.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Desenvolvimento',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Autenticação e registro' },
      { name: 'Clients', description: 'Gerenciamento de clientes' },
      { name: 'Vehicles', description: 'Gerenciamento de veículos' },
      { name: 'Parts', description: 'Gerenciamento de peças' },
      { name: 'Services', description: 'Gerenciamento de serviços' },
      { name: 'Service Orders', description: 'Ordens de serviço' },
    ],
  },
  apis: ['./src/infrastructure/web/routes/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
