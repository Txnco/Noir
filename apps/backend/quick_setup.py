#!/usr/bin/env python3
"""
JetApi Quick Setup
A streamlined setup script for JetApi boilerplate.

Usage:
    python quick_setup.py              # Interactive setup
    python quick_setup.py --quick      # Quick setup with defaults
    python quick_setup.py --seed       # Only run seeders
    python quick_setup.py --migrate    # Only run migrations
    python quick_setup.py --test       # Only run tests
    python quick_setup.py --types      # Only generate types
"""
import os
import sys
import secrets
import subprocess
import re
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
APP_DIR = BASE_DIR / "app"


# ======================
# Console Output
# ======================
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def success(msg): print(f"{Colors.GREEN}✅ {msg}{Colors.END}")
def warning(msg): print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")
def error(msg): print(f"{Colors.RED}❌ {msg}{Colors.END}")
def info(msg): print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")
def header(msg):
    print(f"\n{Colors.BOLD}{'='*50}{Colors.END}")
    print(f"{Colors.BOLD}  {msg}{Colors.END}")
    print(f"{Colors.BOLD}{'='*50}{Colors.END}\n")


# ======================
# Utilities
# ======================
def prompt(message: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    result = input(f"{message}{suffix}: ").strip()
    return result if result else default


def confirm(message: str, default: bool = True) -> bool:
    suffix = " [Y/n]" if default else " [y/N]"
    result = input(f"{message}{suffix}: ").strip().lower()
    if not result:
        return default
    return result in ("y", "yes", "1", "true")


def run_command(cmd: list, capture: bool = False) -> tuple:
    """Run a command and return (success, output)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            cwd=str(BASE_DIR)
        )
        return result.returncode == 0, result.stdout if capture else ""
    except Exception as e:
        return False, str(e)


def generate_secret(length: int = 64) -> str:
    """Generate a secure random secret."""
    return secrets.token_urlsafe(length)


# ======================
# Setup Steps
# ======================
def create_env_file(config: dict) -> bool:
    """Create or update .env file."""
    env_path = BASE_DIR / ".env"
    env_example = BASE_DIR / ".env.example"
    
    try:
        if env_example.exists():
            content = env_example.read_text()
        else:
            content = "DATABASE_URL=sqlite:///./jetapi.db\nSECRET_KEY=change-me\n"
        
        for key, value in config.items():
            pattern = rf'^{key}=.*$'
            replacement = f'{key}={value}'
            if re.search(pattern, content, re.MULTILINE):
                content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
            else:
                content += f"\n{key}={value}"
        
        env_path.write_text(content)
        success("Created .env file")
        return True
    except Exception as e:
        error(f"Failed to create .env: {e}")
        return False


def install_deps() -> bool:
    """Install Python dependencies."""
    info("Installing dependencies...")
    ok, _ = run_command([sys.executable, "-m", "pip", "install", "-r", 
                         str(BASE_DIR / "requirements.txt"), "-q"])
    if ok:
        success("Dependencies installed")
    else:
        error("Failed to install dependencies")
    return ok


def run_migrations() -> bool:
    """Run Alembic migrations."""
    info("Running migrations...")
    
    if not (BASE_DIR / "alembic.ini").exists():
        warning("alembic.ini not found, skipping")
        return True
    
    ok, output = run_command(["alembic", "upgrade", "head"], capture=True)
    if ok:
        success("Migrations completed")
    else:
        warning(f"Migration issue: {output}")
    return True  # Don't fail setup on migration issues


def seed_database() -> bool:
    """Seed database with initial data."""
    info("Seeding database...")
    try:
        sys.path.insert(0, str(BASE_DIR))
        os.chdir(str(BASE_DIR))
        
        # Load environment
        env_path = BASE_DIR / ".env"
        if env_path.exists():
            from dotenv import load_dotenv
            load_dotenv(env_path)
        
        from app.seeders.seed_users import seed_all
        seed_all()
        return True
    except Exception as e:
        error(f"Seeding failed: {e}")
        return False


def run_tests() -> bool:
    """Run test suite."""
    info("Running tests...")
    ok, output = run_command([sys.executable, "-m", "pytest", 
                              str(APP_DIR / "tests"), "-v", "--tb=short"])
    return ok


def generate_types() -> bool:
    """Generate type definitions."""
    info("Generating type definitions...")
    script = BASE_DIR / "scripts" / "generate_types.py"
    if not script.exists():
        warning("Type generator not found")
        return True
    
    ok, output = run_command([sys.executable, str(script), "--all"], capture=True)
    if ok:
        print(output)
        success("Types generated in ./generated/")
    return ok


# ======================
# Setup Modes
# ======================
def quick_setup() -> bool:
    """Quick setup with sensible defaults."""
    header("JetApi Quick Setup")
    
    config = {
        "DATABASE_URL": "sqlite:///./jetapi.db",
        "SECRET_KEY": generate_secret(),
        "JWT_SECRET_KEY": generate_secret(),
        "ENABLE_LOCAL_AUTH": "true",
        "ENABLE_OAUTH2": "false",
        "DEBUG": "true",
    }
    
    steps = [
        ("Environment", lambda: create_env_file(config)),
        ("Dependencies", install_deps),
        ("Migrations", run_migrations),
        ("Seed Data", seed_database),
    ]
    
    for name, func in steps:
        info(f"Step: {name}")
        if not func():
            error(f"Failed at: {name}")
            return False
    
    print_completion_message()
    return True


def interactive_setup() -> bool:
    """Interactive setup with prompts."""
    header("JetApi Setup Wizard")
    
    while True:
        # Database selection
        print("\n📦 Database:")
        print("  1. SQLite (default)")
        print("  2. PostgreSQL")
        print("  3. MySQL")
        print("  b. Back / Cancel")
        
        choice = prompt("Select", "1")
        
        if choice.lower() == "b":
            info("Setup cancelled")
            return False
        
        if choice == "2":
            host = prompt("Host (or 'b' to go back)", "localhost")
            if host.lower() == "b":
                continue
            port = prompt("Port", "5432")
            user = prompt("User", "postgres")
            pwd = prompt("Password", "")
            db = prompt("Database", "jetapi")
            db_url = f"postgresql://{user}:{pwd}@{host}:{port}/{db}"
        elif choice == "3":
            host = prompt("Host (or 'b' to go back)", "localhost")
            if host.lower() == "b":
                continue
            port = prompt("Port", "3306")
            user = prompt("User", "root")
            pwd = prompt("Password", "")
            db = prompt("Database", "jetapi")
            db_url = f"mysql+mysqlconnector://{user}:{pwd}@{host}:{port}/{db}"
        else:
            db_url = "sqlite:///./jetapi.db"
        
        # Auth type
        print("\n🔐 Authentication:")
        print("  1. JWT (local authentication)")
        print("  2. OAuth2 (external provider)")
        print("  3. Both JWT and OAuth2")
        print("  b. Back to database selection")
        
        auth_choice = prompt("Select", "1")
        
        if auth_choice.lower() == "b":
            continue
        
        enable_local = "true" if auth_choice in ("1", "3") else "false"
        enable_oauth2 = "true" if auth_choice in ("2", "3") else "false"
        
        # Determine auth display name
        if auth_choice == "1":
            auth_display = "JWT"
        elif auth_choice == "2":
            auth_display = "OAuth2"
        else:
            auth_display = "JWT + OAuth2"
        
        config = {
            "DATABASE_URL": db_url,
            "SECRET_KEY": generate_secret(),
            "JWT_SECRET_KEY": generate_secret(),
            "ENABLE_LOCAL_AUTH": enable_local,
            "ENABLE_OAUTH2": enable_oauth2,
            "DEBUG": "true",
        }
        
        if enable_oauth2 == "true":
            print("\n🔑 OAuth2 Configuration (or 'b' to go back):")
            issuer = prompt("OAuth2 Issuer URL", "")
            if issuer.lower() == "b":
                continue
            audience = prompt("OAuth2 Audience", "")
            if audience.lower() == "b":
                continue
            if issuer:
                config["OAUTH2_ISSUER"] = issuer
            if audience:
                config["OAUTH2_AUDIENCE"] = audience
        
        # Summary
        db_display = db_url[:50] + "..." if len(db_url) > 50 else db_url
        print(f"\n📝 Configuration Summary:")
        print(f"   Database: {db_display}")
        print(f"   Auth: {auth_display}")
        
        if not confirm("\nProceed with this configuration?"):
            if confirm("Start over?", True):
                continue
            info("Setup cancelled")
            return False
        
        break  # Exit the while loop and proceed
    
    # Run steps
    steps = [
        ("Environment", lambda: create_env_file(config)),
        ("Dependencies", install_deps),
        ("Migrations", run_migrations),
        ("Seed Data", seed_database),
    ]
    
    if confirm("Run tests?", False):
        steps.append(("Tests", run_tests))
    
    if confirm("Generate types?", False):
        steps.append(("Types", generate_types))
    
    for name, func in steps:
        info(f"Step: {name}")
        if not func():
            error(f"Failed at: {name}")
            return False
    
    print_completion_message()
    return True


def print_completion_message():
    """Print setup completion message."""
    header("Setup Complete! 🚀")
    print("""
📋 Default Accounts:
   Admin: admin@example.com / Admin123!
   User:  user@example.com / User123!

🚀 Start Server:
   uvicorn app.main:app --reload

📖 API Docs:
   http://localhost:8000/docs

🔧 Run Tests:
   pytest app/tests -v

📦 Generate Types:
   python scripts/generate_types.py --all
""")


# ======================
# Main
# ======================
def main():
    args = sys.argv[1:]
    
    if "--help" in args or "-h" in args:
        print(__doc__)
        return
    
    if "--seed" in args:
        seed_database()
    elif "--migrate" in args:
        run_migrations()
    elif "--test" in args:
        run_tests()
    elif "--types" in args:
        generate_types()
    elif "--quick" in args or "-q" in args:
        quick_setup()
    else:
        interactive_setup()


if __name__ == "__main__":
    main()
