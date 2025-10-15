const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VAPI Platform Integration API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for VAPI platform integration with voice AI capabilities',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://your-production-domain.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              example: 'Detailed error information'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        Model: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'gpt-4o'
            },
            name: {
              type: 'string',
              example: 'GPT-4o'
            },
            provider: {
              type: 'string',
              example: 'openai'
            },
            description: {
              type: 'string',
              example: 'Most capable GPT-4 model'
            }
          }
        },
        Voice: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'sarah'
            },
            name: {
              type: 'string',
              example: 'Sarah'
            },
            provider: {
              type: 'string',
              example: '11labs'
            },
            gender: {
              type: 'string',
              example: 'female'
            },
            accent: {
              type: 'string',
              example: 'american'
            },
            description: {
              type: 'string',
              example: 'Warm and professional'
            }
          }
        },
        Transcriber: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              example: 'deepgram'
            },
            models: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    example: 'nova-2'
                  },
                  name: {
                    type: 'string',
                    example: 'Nova 2'
                  },
                  description: {
                    type: 'string',
                    example: 'Latest and most accurate model'
                  },
                  language: {
                    type: 'string',
                    example: 'en'
                  },
                  realtime: {
                    type: 'boolean',
                    example: true
                  }
                }
              }
            },
            features: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['real-time', 'batch', 'punctuation', 'diarization']
            },
            languages: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['en', 'es', 'fr', 'de']
            },
            confidenceThreshold: {
              type: 'number',
              example: 0.5
            }
          }
        },
        Assistant: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'asst_123'
            },
            name: {
              type: 'string',
              example: 'Customer Support Assistant'
            },
            firstMessage: {
              type: 'string',
              example: 'Hello! How can I help you today?'
            },
            transcriber: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  example: 'deepgram'
                },
                model: {
                  type: 'string',
                  example: 'nova-2'
                }
              }
            },
            model: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  example: 'openai'
                },
                model: {
                  type: 'string',
                  example: 'gpt-4o'
                }
              }
            },
            voice: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  example: '11labs'
                },
                voiceId: {
                  type: 'string',
                  example: 'sarah'
                }
              }
            }
          }
        },
        PhoneNumber: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'pn_123'
            },
            twilioPhoneNumber: {
              type: 'string',
              example: '+1234567890'
            },
            name: {
              type: 'string',
              example: 'Main Support Line'
            },
            assistantId: {
              type: 'string',
              example: 'asst_123'
            }
          }
        },
        Call: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'call_123'
            },
            status: {
              type: 'string',
              example: 'completed'
            },
            assistantId: {
              type: 'string',
              example: 'asst_123'
            },
            phoneNumber: {
              type: 'string',
              example: '+1234567890'
            },
            duration: {
              type: 'number',
              example: 420
            },
            cost: {
              type: 'number',
              example: 0.85
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Models',
        description: 'AI model management and configuration'
      },
      {
        name: 'Voices',
        description: 'Text-to-speech voice management'
      },
      {
        name: 'Transcribers',
        description: 'Speech-to-text transcriber management'
      },
      {
        name: 'Assistants',
        description: 'AI assistant management'
      },
      {
        name: 'Phone Numbers',
        description: 'Phone number management and telephony'
      },
      {
        name: 'Calls',
        description: 'Call management and outbound calling'
      },
      {
        name: 'Tools',
        description: 'Function tools and integrations'
      },
      {
        name: 'Files',
        description: 'File upload and management'
      },
      {
        name: 'Knowledge Bases',
        description: 'Knowledge base and RAG functionality'
      },
      {
        name: 'Sessions',
        description: 'Conversation session management'
      },
      {
        name: 'Chats',
        description: 'Chat and messaging functionality'
      },
      {
        name: 'Squads',
        description: 'Multi-assistant squad management'
      },
      {
        name: 'Workflows',
        description: 'Workflow automation and management'
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting'
      },
      {
        name: 'Logs',
        description: 'System logs and monitoring'
      },
      {
        name: 'Webhooks',
        description: 'Webhook handling and configuration'
      }
    ]
  },
  apis: [
    './routes/*/*.js',
    './controller/*/*.js',
    './docs/swagger-endpoints.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
};
