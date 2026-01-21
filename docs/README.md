# Forge Factory Documentation

Welcome to the Forge Factory documentation! This directory contains all technical and product documentation for the platform.

## 📚 Documentation Structure

### [00. Overview](./00-overview/)
High-level business and methodology documentation
- **[The Forge Factory](./00-overview/the-forge-factory.md)** - Business model, factory pipeline, and operations
- **[The Forge Method v4.1](./00-overview/the-forge-method.md)** - Development methodology and technical approach

### [01. Product](./01-product/)
Product specifications and requirements
- **[Product Specification](./01-product/product-spec.md)** - Complete product requirements and features

### [02. Architecture](./02-architecture/)
Technical architecture and design decisions
- **[Architecture Overview](./02-architecture/architecture.md)** - System architecture and technical design
- **[Integrations](./02-architecture/integrations.md)** - Third-party integrations and APIs
- **[Security & Compliance](./02-architecture/security-compliance.md)** - Security model and compliance framework
- **[Architecture Decisions](./02-architecture/decisions/)** - Architecture Decision Records (ADRs)

### [03. Features](./03-features/)
Detailed feature specifications and designs
- **[01. Repository Analyzer](./03-features/01-repository-analyzer.md)** - Code analysis feature design
- **[02. CLAUDE.md Generator](./03-features/02-claude-md-generator.md)** - Documentation generator
- **[03. GitHub Integration](./03-features/03-github-integration.md)** - GitHub integration design
- **[04. LLM Provider Integration](./03-features/04-llm-provider-integration.md)** - AI provider integration

### [04. Development](./04-development/)
Developer guides and contribution guidelines
- Setup instructions
- Development workflows
- Testing guidelines
- Contributing guide

### [05. Operations](./05-operations/)
Operations guides and runbooks
- Deployment procedures
- Monitoring and alerting
- Incident response
- Runbooks for common operations

## 🎯 Quick Links

### For Developers
- [Getting Started](./04-development/README.md) - Set up your development environment
- [Architecture Overview](./02-architecture/architecture.md) - Understand the system design
- [Architecture Decisions](./02-architecture/decisions/README.md) - Review ADRs
- [Contributing Guide](./04-development/README.md) - How to contribute

### For Product Managers
- [Product Specification](./01-product/product-spec.md) - Complete feature list
- [Feature Designs](./03-features/) - Detailed feature specifications
- [The Forge Factory](./00-overview/the-forge-factory.md) - Business context

### For Architects
- [Architecture Overview](./02-architecture/architecture.md) - System architecture
- [ADRs](./02-architecture/decisions/README.md) - All architecture decisions
- [Security & Compliance](./02-architecture/security-compliance.md) - Security model
- [Integrations](./02-architecture/integrations.md) - Integration architecture

### For Operations
- [Deployment Guide](./05-operations/README.md) - How to deploy
- [Runbooks](./05-operations/runbooks/) - Operational procedures
- [Monitoring](./05-operations/README.md) - Observability setup

## 📋 Documentation Standards

All documentation in this repository follows these standards:

1. **Markdown Format**: All docs use GitHub-flavored Markdown
2. **Naming Convention**: Use lowercase with hyphens (kebab-case)
3. **Versioning**: Document major changes with dates
4. **Cross-References**: Use relative links between documents
5. **Code Examples**: Include practical, runnable examples
6. **Diagrams**: Use ASCII art, Mermaid, or link to external diagrams

## 🔄 Keeping Docs Updated

Documentation is a living resource:

- **ADRs**: Create new ADRs for significant architectural decisions
- **Features**: Update feature docs as designs evolve
- **Architecture**: Keep architecture docs in sync with implementation
- **Operations**: Update runbooks based on incidents and learnings

## 📝 Contributing to Documentation

When adding or updating documentation:

1. Place docs in the appropriate directory
2. Update this README if adding new top-level sections
3. Follow the documentation standards above
4. Include examples and diagrams where helpful
5. Link to related documents
6. Review for accuracy and clarity

## 🆘 Need Help?

- **General Questions**: See [README.md](../README.md) in project root
- **Development Setup**: See [Development Guide](./04-development/README.md)
- **Architecture Questions**: Review [ADRs](./02-architecture/decisions/README.md)
- **Operations Issues**: Check [Runbooks](./05-operations/runbooks/)

---

**Last Updated**: January 2024
**Documentation Version**: 1.0
