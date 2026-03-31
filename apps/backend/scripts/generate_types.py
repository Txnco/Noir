"""
Type Generator
Generates type definitions for other frameworks (TypeScript, Dart/Flutter, etc.)
from Pydantic schemas.
"""
import os
import sys
import json
import argparse
from pathlib import Path
from typing import Any, Dict, List, Optional, get_type_hints, get_origin, get_args
from datetime import datetime
from enum import Enum

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.resolve()))

from pydantic import BaseModel


# ======================
# Type Mappings
# ======================
PYTHON_TO_TYPESCRIPT: Dict[str, str] = {
    "str": "string",
    "int": "number",
    "float": "number",
    "bool": "boolean",
    "datetime": "string",  # ISO 8601 format
    "date": "string",
    "time": "string",
    "UUID": "string",
    "Any": "any",
    "None": "null",
    "NoneType": "null",
    "dict": "Record<string, any>",
    "Dict": "Record<string, any>",
}

PYTHON_TO_DART: Dict[str, str] = {
    "str": "String",
    "int": "int",
    "float": "double",
    "bool": "bool",
    "datetime": "DateTime",
    "date": "DateTime",
    "time": "String",
    "UUID": "String",
    "Any": "dynamic",
    "None": "void",
    "NoneType": "void",
    "dict": "Map<String, dynamic>",
    "Dict": "Map<String, dynamic>",
}


# ======================
# Schema Discovery
# ======================
def discover_schemas() -> Dict[str, type]:
    """Discover all Pydantic models in the schemas directory."""
    schemas = {}
    
    # Import all schema modules
    from app.schemas import user, auth
    try:
        from app.schemas import role, permission
    except ImportError:
        pass
    
    # Collect all BaseModel subclasses
    for module in [user, auth]:
        for name, obj in vars(module).items():
            if isinstance(obj, type) and issubclass(obj, BaseModel) and obj is not BaseModel:
                schemas[name] = obj
    
    return schemas


def get_python_type_name(type_hint: Any) -> str:
    """Get the string name of a Python type."""
    origin = get_origin(type_hint)
    
    if origin is None:
        if hasattr(type_hint, "__name__"):
            return type_hint.__name__
        return str(type_hint)
    
    return str(origin.__name__) if hasattr(origin, "__name__") else str(origin)


def get_field_type(type_hint: Any, type_map: Dict[str, str], for_dart: bool = False) -> str:
    """Convert a Python type hint to target language type."""
    origin = get_origin(type_hint)
    args = get_args(type_hint)
    
    # Handle None/Optional types
    if type_hint is type(None):
        return type_map.get("None", "null")
    
    # Handle Optional[X] (Union[X, None])
    if origin is type(None) or (hasattr(origin, "__origin__") and origin.__origin__ is type(None)):
        return type_map.get("None", "null")
    
    # Check if it's a Union type (Optional is Union[X, None])
    if origin is not None and str(origin) == "typing.Union":
        # Filter out NoneType
        non_none_args = [a for a in args if a is not type(None)]
        if len(non_none_args) == 1:
            # This is Optional[X]
            inner_type = get_field_type(non_none_args[0], type_map, for_dart)
            if for_dart:
                return f"{inner_type}?"
            return f"{inner_type} | null"
        else:
            # Multiple types - union
            types = [get_field_type(a, type_map, for_dart) for a in non_none_args]
            if for_dart:
                return "dynamic"
            return " | ".join(types)
    
    # Handle List[X]
    if origin is list or str(origin) == "<class 'list'>":
        if args:
            inner_type = get_field_type(args[0], type_map, for_dart)
            if for_dart:
                return f"List<{inner_type}>"
            return f"{inner_type}[]"
        if for_dart:
            return "List<dynamic>"
        return "any[]"
    
    # Handle Dict[K, V]
    if origin is dict or str(origin) == "<class 'dict'>":
        if args and len(args) == 2:
            key_type = get_field_type(args[0], type_map, for_dart)
            value_type = get_field_type(args[1], type_map, for_dart)
            if for_dart:
                return f"Map<{key_type}, {value_type}>"
            return f"Record<{key_type}, {value_type}>"
        return type_map.get("dict", "Record<string, any>")
    
    # Get type name and look up in map
    type_name = get_python_type_name(type_hint)
    
    # Check if it's a Pydantic model (reference to another type)
    if isinstance(type_hint, type) and issubclass(type_hint, BaseModel):
        return type_name
    
    return type_map.get(type_name, type_name)


# ======================
# TypeScript Generator
# ======================
def generate_typescript(schemas: Dict[str, type], output_path: Path) -> None:
    """Generate TypeScript interfaces from Pydantic schemas."""
    lines = [
        "// Auto-generated TypeScript types from JetApi schemas",
        "// Do not edit manually - regenerate with: python scripts/generate_types.py --typescript",
        f"// Generated at: {datetime.now().isoformat()}",
        "",
    ]
    
    for name, schema in schemas.items():
        lines.append(f"export interface {name} {{")
        
        # Get field annotations
        if hasattr(schema, "model_fields"):
            # Pydantic v2
            for field_name, field_info in schema.model_fields.items():
                field_type = get_field_type(field_info.annotation, PYTHON_TO_TYPESCRIPT)
                optional = "?" if not field_info.is_required() else ""
                lines.append(f"  {field_name}{optional}: {field_type};")
        else:
            # Pydantic v1 fallback
            for field_name, field in schema.__fields__.items():
                field_type = get_field_type(field.outer_type_, PYTHON_TO_TYPESCRIPT)
                optional = "?" if not field.required else ""
                lines.append(f"  {field_name}{optional}: {field_type};")
        
        lines.append("}")
        lines.append("")
    
    # Add API response types
    lines.extend([
        "// API Response wrapper types",
        "export interface ApiResponse<T> {",
        "  data: T;",
        "  message?: string;",
        "  success: boolean;",
        "}",
        "",
        "export interface ApiError {",
        "  detail: string;",
        "  status_code: number;",
        "}",
        "",
        "export interface PaginatedResponse<T> {",
        "  items: T[];",
        "  total: number;",
        "  page: number;",
        "  page_size: number;",
        "  total_pages: number;",
        "}",
    ])
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ TypeScript types generated: {output_path}")


# ======================
# Dart/Flutter Generator
# ======================
def generate_dart(schemas: Dict[str, type], output_path: Path) -> None:
    """Generate Dart/Flutter classes from Pydantic schemas."""
    lines = [
        "// Auto-generated Dart types from JetApi schemas",
        "// Do not edit manually - regenerate with: python scripts/generate_types.py --dart",
        f"// Generated at: {datetime.now().isoformat()}",
        "",
        "import 'package:json_annotation/json_annotation.dart';",
        "",
        "part 'api_types.g.dart';",
        "",
    ]
    
    for name, schema in schemas.items():
        lines.append(f"@JsonSerializable()")
        lines.append(f"class {name} {{")
        
        # Collect fields
        fields = []
        if hasattr(schema, "model_fields"):
            # Pydantic v2
            for field_name, field_info in schema.model_fields.items():
                field_type = get_field_type(field_info.annotation, PYTHON_TO_DART, for_dart=True)
                is_required = field_info.is_required()
                fields.append((field_name, field_type, is_required))
        else:
            # Pydantic v1 fallback
            for field_name, field in schema.__fields__.items():
                field_type = get_field_type(field.outer_type_, PYTHON_TO_DART, for_dart=True)
                is_required = field.required
                fields.append((field_name, field_type, is_required))
        
        # Add field declarations
        for field_name, field_type, is_required in fields:
            if is_required:
                lines.append(f"  final {field_type} {field_name};")
            else:
                # Add ? for nullable types if not already there
                if not field_type.endswith("?"):
                    field_type = f"{field_type}?"
                lines.append(f"  final {field_type} {field_name};")
        
        lines.append("")
        
        # Constructor
        lines.append(f"  {name}({{")
        for field_name, field_type, is_required in fields:
            if is_required:
                lines.append(f"    required this.{field_name},")
            else:
                lines.append(f"    this.{field_name},")
        lines.append("  });")
        lines.append("")
        
        # JSON factory
        lines.append(f"  factory {name}.fromJson(Map<String, dynamic> json) => _${name}FromJson(json);")
        lines.append(f"  Map<String, dynamic> toJson() => _${name}ToJson(this);")
        
        lines.append("}")
        lines.append("")
    
    # Add API response wrapper
    lines.extend([
        "// API Response wrapper",
        "@JsonSerializable(genericArgumentFactories: true)",
        "class ApiResponse<T> {",
        "  final T data;",
        "  final String? message;",
        "  final bool success;",
        "",
        "  ApiResponse({required this.data, this.message, required this.success});",
        "",
        "  factory ApiResponse.fromJson(",
        "    Map<String, dynamic> json,",
        "    T Function(Object? json) fromJsonT,",
        "  ) => _$ApiResponseFromJson(json, fromJsonT);",
        "",
        "  Map<String, dynamic> toJson(Object Function(T value) toJsonT) =>",
        "    _$ApiResponseToJson(this, toJsonT);",
        "}",
    ])
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ Dart types generated: {output_path}")
    print(f"   Run 'dart run build_runner build' to generate .g.dart file")


# ======================
# JSON Schema Generator
# ======================
def generate_json_schema(schemas: Dict[str, type], output_path: Path) -> None:
    """Generate JSON Schema from Pydantic schemas."""
    all_schemas = {}
    
    for name, schema in schemas.items():
        if hasattr(schema, "model_json_schema"):
            # Pydantic v2
            all_schemas[name] = schema.model_json_schema()
        else:
            # Pydantic v1
            all_schemas[name] = schema.schema()
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(all_schemas, indent=2), encoding="utf-8")
    print(f"✅ JSON Schema generated: {output_path}")


# ======================
# OpenAPI Schema Export
# ======================
def generate_openapi(output_path: Path) -> None:
    """Export OpenAPI schema from FastAPI app."""
    from app.main import app
    
    openapi_schema = app.openapi()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(openapi_schema, indent=2), encoding="utf-8")
    print(f"✅ OpenAPI schema generated: {output_path}")


# ======================
# Main Entry Point
# ======================
def main():
    parser = argparse.ArgumentParser(description="Generate types from Pydantic schemas")
    parser.add_argument("--typescript", "-ts", action="store_true", help="Generate TypeScript types")
    parser.add_argument("--dart", "-d", action="store_true", help="Generate Dart/Flutter types")
    parser.add_argument("--json-schema", "-js", action="store_true", help="Generate JSON Schema")
    parser.add_argument("--openapi", "-oa", action="store_true", help="Export OpenAPI schema")
    parser.add_argument("--all", "-a", action="store_true", help="Generate all type formats")
    parser.add_argument("--output", "-o", type=str, default="generated", help="Output directory")
    
    args = parser.parse_args()
    
    # Default to all if no specific format is selected
    if not any([args.typescript, args.dart, args.json_schema, args.openapi, args.all]):
        args.all = True
    
    output_dir = Path(args.output)
    schemas = discover_schemas()
    
    print(f"📦 Discovered {len(schemas)} schemas: {', '.join(schemas.keys())}")
    print("-" * 40)
    
    if args.typescript or args.all:
        generate_typescript(schemas, output_dir / "typescript" / "api-types.ts")
    
    if args.dart or args.all:
        generate_dart(schemas, output_dir / "dart" / "api_types.dart")
    
    if args.json_schema or args.all:
        generate_json_schema(schemas, output_dir / "json-schema" / "schemas.json")
    
    if args.openapi or args.all:
        generate_openapi(output_dir / "openapi" / "openapi.json")
    
    print("-" * 40)
    print("✅ Type generation complete!")


if __name__ == "__main__":
    main()
