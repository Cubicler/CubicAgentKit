#!/bin/bash

# Integration Test Runner for CubicAgentKit
# This script sets up Docker services and runs integration tests

set -e

echo "🧪 CubicAgentKit Integration Test Runner"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CUBICLER_DIR="../../Cubicler"
COMPOSE_FILE="docker-compose.test.yml"
TIMEOUT=120

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_status "Docker is running"
}

# Function to check if Cubicler directory exists
check_cubicler() {
    if [ ! -d "$CUBICLER_DIR" ]; then
        print_warning "Cubicler directory not found at $CUBICLER_DIR"
        print_warning "Integration tests will use mock services only"
        return 1
    fi
    print_status "Cubicler directory found"
    return 0
}

# Function to start Docker services
start_services() {
    print_status "Starting Docker services..."
    
    if ! docker-compose -f "$COMPOSE_FILE" up -d; then
        print_error "Failed to start Docker services"
        exit 1
    fi
    
    print_status "Docker services started"
}

# Function to wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    local attempts=0
    local max_attempts=$((TIMEOUT / 5))
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f http://localhost:1503/health > /dev/null 2>&1; then
            print_status "Cubicler is ready"
            return 0
        fi
        
        attempts=$((attempts + 1))
        echo "Attempt $attempts/$max_attempts - waiting for Cubicler..."
        sleep 5
    done
    
    print_error "Services did not become ready within $TIMEOUT seconds"
    return 1
}

# Function to run tests
run_tests() {
    print_status "Running integration tests..."
    
    if npm run test:integration:run; then
        print_status "Integration tests passed!"
        return 0
    else
        print_error "Integration tests failed!"
        return 1
    fi
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up Docker services..."
    docker-compose -f "$COMPOSE_FILE" down -v > /dev/null 2>&1 || true
    print_status "Cleanup complete"
}

# Main execution
main() {
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Check prerequisites
    check_docker
    
    # Check if Cubicler is available
    if ! check_cubicler; then
        print_warning "Running in mock mode"
    fi
    
    # Start services
    start_services
    
    # Wait for services
    if ! wait_for_services; then
        print_error "Aborting due to service startup failure"
        exit 1
    fi
    
    # Run tests
    if run_tests; then
        print_status "All integration tests completed successfully! 🎉"
        exit 0
    else
        print_error "Integration tests failed"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --cleanup     Clean up Docker services and exit"
        echo ""
        echo "Environment Variables:"
        echo "  TIMEOUT       Timeout for service startup (default: 120 seconds)"
        echo "  CUBICLER_DIR  Path to Cubicler directory (default: ../Cubicler)"
        exit 0
        ;;
    "--cleanup")
        cleanup
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
