FROM ubuntu:20.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install basic tools and programming languages
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    vim \
    nano \
    build-essential \
    python3 \
    python3-pip \
    nodejs \
    npm \
    openjdk-11-jdk \
    golang-go \
    rustc \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install \
    numpy \
    pandas \
    matplotlib \
    requests \
    flask \
    django

# Install Node.js packages globally
RUN npm install -g \
    express \
    lodash \
    axios

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Create non-root user for security
RUN useradd -m -s /bin/bash labuser && \
    chown -R labuser:labuser /workspace

# Switch to non-root user
USER labuser

# Set up environment
ENV PATH="/home/labuser/.local/bin:$PATH"
ENV PYTHONPATH="/workspace:$PYTHONPATH"

# Default command
CMD ["/bin/bash"]
