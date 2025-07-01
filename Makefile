# ===========================================
# Makefile for AdonisJS 6 / Angular 20 E-commerce Project
# ===========================================

# Variables
BACKEND_DIR = backend
FRONTEND_DIR = frontend
DB_CONTAINER = ecommerce-db-1
ADMINER_CONTAINER = ecommerce-adminer-1

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

.PHONY: help install dev build test clean docker-up docker-down db-migrate db-seed lint format

# Default target
help: ## Show this help message
	@echo "$(GREEN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# ===========================================
# Installation & Setup
# ===========================================

install: ## Install all dependencies (backend + frontend)
	@echo "$(GREEN)Installing backend dependencies...$(NC)"
	cd $(BACKEND_DIR) && npm install
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "$(GREEN)Installing frontend dependencies...$(NC)"; \
		cd $(FRONTEND_DIR) && npm install; \
	fi

setup: install docker-up db-migrate db-seed ## Complete project setup (install + docker + db)
	@echo "$(GREEN)Project setup complete!$(NC)"

# ===========================================
# Development
# ===========================================

dev: ## Start development servers (backend + frontend)
	@echo "$(GREEN)Starting development servers...$(NC)"
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		cd $(FRONTEND_DIR) && npm run dev & \
	fi
	cd $(BACKEND_DIR) && npm run dev

dev-backend: ## Start only backend development server
	@echo "$(GREEN)Starting backend development server...$(NC)"
	cd $(BACKEND_DIR) && npm run dev

dev-frontend: ## Start only frontend development server
	@echo "$(GREEN)Starting frontend development server...$(NC)"
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		cd $(FRONTEND_DIR) && npm run dev; \
	else \
		echo "$(RED)Frontend directory not found$(NC)"; \
	fi

# ===========================================
# Build & Production
# ===========================================

build: ## Build both backend and frontend for production
	@echo "$(GREEN)Building backend...$(NC)"
	cd $(BACKEND_DIR) && npm run build
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "$(GREEN)Building frontend...$(NC)"; \
		cd $(FRONTEND_DIR) && npm run build; \
	fi

start: ## Start production server
	@echo "$(GREEN)Starting production server...$(NC)"
	cd $(BACKEND_DIR) && npm start

# ===========================================
# Testing
# ===========================================

test: ## Run all tests
	@echo "$(GREEN)Running backend tests...$(NC)"
	cd $(BACKEND_DIR) && npm test
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "$(GREEN)Running frontend tests...$(NC)"; \
		cd $(FRONTEND_DIR) && npm test; \
	fi

test-backend: ## Run only backend tests
	@echo "$(GREEN)Running backend tests...$(NC)"
	cd $(BACKEND_DIR) && npm test

test-frontend: ## Run only frontend tests
	@echo "$(GREEN)Running frontend tests...$(NC)"
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		cd $(FRONTEND_DIR) && npm test; \
	else \
		echo "$(RED)Frontend directory not found$(NC)"; \
	fi

test-watch: ## Run backend tests in watch mode
	@echo "$(GREEN)Running backend tests in watch mode...$(NC)"
	cd $(BACKEND_DIR) && npm test -- --watch

# ===========================================
# Code Quality
# ===========================================

lint: ## Lint code (backend + frontend)
	@echo "$(GREEN)Linting backend code...$(NC)"
	cd $(BACKEND_DIR) && npm run lint
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "$(GREEN)Linting frontend code...$(NC)"; \
		cd $(FRONTEND_DIR) && npm run lint; \
	fi

format: ## Format code (backend + frontend)
	@echo "$(GREEN)Formatting backend code...$(NC)"
	cd $(BACKEND_DIR) && npm run format
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "$(GREEN)Formatting frontend code...$(NC)"; \
		cd $(FRONTEND_DIR) && npm run format; \
	fi

typecheck: ## Run TypeScript type checking
	@echo "$(GREEN)Type checking backend...$(NC)"
	cd $(BACKEND_DIR) && npm run typecheck
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "$(GREEN)Type checking frontend...$(NC)"; \
		cd $(FRONTEND_DIR) && npm run typecheck; \
	fi

# ===========================================
# Database Operations
# ===========================================

db-migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	cd $(BACKEND_DIR) && node ace migration:run

db-rollback: ## Rollback last migration
	@echo "$(YELLOW)Rolling back last migration...$(NC)"
	cd $(BACKEND_DIR) && node ace migration:rollback

db-seed: ## Run database seeders
	@echo "$(GREEN)Running database seeders...$(NC)"
	cd $(BACKEND_DIR) && node ace db:seed

db-reset: ## Reset database (rollback all + migrate + seed)
	@echo "$(YELLOW)Resetting database...$(NC)"
	cd $(BACKEND_DIR) && node ace migration:reset && node ace migration:run && node ace db:seed

db-fresh: ## Fresh database (drop + migrate + seed)
	@echo "$(YELLOW)Creating fresh database...$(NC)"
	cd $(BACKEND_DIR) && node ace migration:fresh --seed

# ===========================================
# Docker Operations
# ===========================================

docker-up: ## Start Docker containers (PostgreSQL + Adminer)
	@echo "$(GREEN)Starting Docker containers...$(NC)"
	docker compose up -d

docker-down: ## Stop Docker containers
	@echo "$(YELLOW)Stopping Docker containers...$(NC)"
	docker compose down

docker-logs: ## Show Docker container logs
	@echo "$(GREEN)Docker container logs:$(NC)"
	docker compose logs -f

docker-restart: docker-down docker-up ## Restart Docker containers

# ===========================================
# AdonisJS Specific Commands
# ===========================================

ace: ## Run AdonisJS Ace command (usage: make ace COMMAND="migration:make CreateUsersTable")
	@if [ -z "$(COMMAND)" ]; then \
		echo "$(RED)Usage: make ace COMMAND=\"your-ace-command\"$(NC)"; \
		exit 1; \
	fi
	cd $(BACKEND_DIR) && node ace $(COMMAND)

module: ## Create new module (usage: make module NAME="product")
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)Usage: make module NAME=\"module-name\"$(NC)"; \
		exit 1; \
	fi
	cd $(BACKEND_DIR) && node ace make:module $(NAME) -m -migration -t

controller: ## Create controller (usage: make controller NAME="ProductController")
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)Usage: make controller NAME=\"ControllerName\"$(NC)"; \
		exit 1; \
	fi
	cd $(BACKEND_DIR) && node ace make:controller $(NAME)

model: ## Create model (usage: make model NAME="Product")
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)Usage: make model NAME=\"ModelName\"$(NC)"; \
		exit 1; \
	fi
	cd $(BACKEND_DIR) && node ace make:model $(NAME)

migration: ## Create migration (usage: make migration NAME="create_products_table")
	@if [ -z "$(NAME)" ]; then \
		echo "$(RED)Usage: make migration NAME=\"migration_name\"$(NC)"; \
		exit 1; \
	fi
	cd $(BACKEND_DIR) && node ace make:migration $(NAME)

# ===========================================
# Utility Commands
# ===========================================

logs: ## Show application logs
	@echo "$(GREEN)Application logs:$(NC)"
	cd $(BACKEND_DIR) && tail -f logs/app.log 2>/dev/null || echo "No log file found"

clean: ## Clean node_modules and build artifacts
	@echo "$(YELLOW)Cleaning backend...$(NC)"
	cd $(BACKEND_DIR) && rm -rf node_modules dist build .tmp
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "$(YELLOW)Cleaning frontend...$(NC)"; \
		cd $(FRONTEND_DIR) && rm -rf node_modules dist .angular; \
	fi

status: ## Show project status
	@echo "$(GREEN)Project Status:$(NC)"
	@echo "Backend directory: $(BACKEND_DIR)"
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		echo "Frontend directory: $(FRONTEND_DIR)"; \
	else \
		echo "Frontend directory: Not found"; \
	fi
	@echo "Docker containers:"
	@docker compose ps 2>/dev/null || echo "Docker not running"

health: ## Check application health
	@echo "$(GREEN)Checking application health...$(NC)"
	@curl -s http://localhost:3333/api/health 2>/dev/null | head -1 || echo "Backend not responding"
	@if [ -d "$(FRONTEND_DIR)" ]; then \
		curl -s http://localhost:4200 2>/dev/null > /dev/null && echo "Frontend: OK" || echo "Frontend: Not responding"; \
	fi

# ===========================================
# Git Operations
# ===========================================

commit: lint test ## Lint, test, then commit changes
	@echo "$(GREEN)All checks passed. Ready to commit!$(NC)"
	git add .
	git status

push: commit ## Commit and push changes
	git push origin $$(git branch --show-current)

# ===========================================
# Environment
# ===========================================

env-copy: ## Copy environment file
	@if [ ! -f "$(BACKEND_DIR)/.env" ]; then \
		echo "$(GREEN)Copying .env.example to .env...$(NC)"; \
		cd $(BACKEND_DIR) && cp .env.example .env; \
	else \
		echo "$(YELLOW).env file already exists$(NC)"; \
	fi

# ===========================================
# Quick Development Shortcuts
# ===========================================

quick-setup: docker-up env-copy install db-migrate db-seed ## Quick project setup for new developers
	@echo "$(GREEN) Quick setup complete!$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Update $(BACKEND_DIR)/.env with your settings"
	@echo "  2. Run 'make dev' to start development servers"
	@echo "  3. Visit http://localhost:3333 for backend API"
	@echo "  4. Visit http://localhost:8080 for Adminer (DB admin)"

restart: docker-restart db-migrate dev ## Restart everything (Docker + DB + Dev servers)

all-checks: lint typecheck test ## Run all code quality checks
	@echo "$(GREEN) All checks passed!$(NC)"