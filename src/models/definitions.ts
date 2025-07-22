import { JSONValue } from "./types";

// Detailed provider definition types (for internal use)

export interface ProviderDefinition {
    version: number;
    services: Record<string, ServiceDefinition>;
    functions: Record<string, FunctionDefinition>;
}

export interface EndpointDefinition {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    headers?: Record<string, string>;
    parameters?: Record<string, ParameterDefinition>;
    payload?: PayloadDefinition;
}

export interface ServiceDefinition {
    base_url: string;
    default_headers?: Record<string, string>;
    endpoints: Record<string, EndpointDefinition>;
}

export interface FunctionDefinition {
    service: string;
    endpoint: string;
    description: string;
    override_parameters?: Record<string, JSONValue>;
    override_payload?: JSONValue;
}

export interface PayloadDefinition {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    items?: PayloadDefinition;
    properties?: Record<string, PayloadDefinition>;
}

export interface ParameterDefinition {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    items?: ParameterDefinition;
    properties?: Record<string, ParameterDefinition>;
}export interface AgentFunctionDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, ParameterDefinition>;
        required?: string[];
    };
}

