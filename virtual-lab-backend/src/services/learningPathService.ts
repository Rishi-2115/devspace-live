import { PrismaClient } from '@prisma/client';
import { LearningPath, LearningNode, UserProgress, Skill, Prerequisite } from '../types/learningPath';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class LearningPathService {
  /**
   * Create a new learning path
   */
  async createLearningPath(pathData: {
    title: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedDuration: number;
    skills: string[];
    createdBy: string;
  }): Promise<LearningPath> {
    try {
      const learningPath = await prisma.learningPath.create({
        data: {
          title: pathData.title,
          description: pathData.description,
          difficulty: pathData.difficulty,
          estimatedDuration: pathData.estimatedDuration,
          createdBy: pathData.createdBy,
          skills: {
            connect: pathData.skills.map(skillId => ({ id: skillId }))
          }
        },
        include: {
          nodes: true,
          skills: true,
          enrollments: true
        }
      });

      logger.info(`Learning path created: ${learningPath.id}`);
      return learningPath;
    } catch (error) {
      logger.error('Error creating learning path:', error);
      throw new Error('Failed to create learning path');
    }
  }

  /**
   * Add a learning node to a path
   */
  async addLearningNode(pathId: string, nodeData: {
    title: string;
    description: string;
    type: 'lesson' | 'exercise' | 'project' | 'quiz' | 'assignment';
    content: any;
    order: number;
    prerequisites?: string[];
    estimatedTime: number;
    difficulty: number;
  }): Promise<LearningNode> {
    try {
      const node = await prisma.learningNode.create({
        data: {
          title: nodeData.title,
          description: nodeData.description,
          type: nodeData.type,
          content: nodeData.content,
          order: nodeData.order,
          estimatedTime: nodeData.estimatedTime,
          difficulty: nodeData.difficulty,
          learningPathId: pathId,
          prerequisites: {
            create: nodeData.prerequisites?.map(prereqId => ({
              prerequisiteNodeId: prereqId
            })) || []
          }
        },
        include: {
          prerequisites: true,
          dependents: true
        }
      });

      logger.info(`Learning node added: ${node.id} to path: ${pathId}`);
      return node;
    } catch (error) {
      logger.error('Error adding learning node:', error);
      throw new Error('Failed to add learning node');
    }
  }

  /**
   * Get personalized learning path for a user
   */
  async getPersonalizedPath(userId: string, targetSkills: string[]): Promise<LearningPath[]> {
    try {
      // Get user's current progress and skills
      const userProgress = await this.getUserProgress(userId);
      const userSkills = await this.getUserSkills(userId);

      // Find learning paths that match target skills
      const availablePaths = await prisma.learningPath.findMany({
        where: {
          skills: {
            some: {
              id: { in: targetSkills }
            }
          }
        },
        include: {
          nodes: {
            include: {
              prerequisites: true,
              progress: {
                where: { userId }
              }
            },
            orderBy: { order: 'asc' }
          },
          skills: true,
          enrollments: {
            where: { userId }
          }
        }
      });

      // Score and rank paths based on user profile
      const scoredPaths = availablePaths.map(path => ({
        ...path,
        relevanceScore: this.calculatePathRelevance(path, userSkills, userProgress),
        completionRate: this.calculateCompletionRate(path, userProgress)
      }));

      // Sort by relevance and return top recommendations
      return scoredPaths
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);
    } catch (error) {
      logger.error('Error getting personalized path:', error);
      throw new Error('Failed to get personalized learning path');
    }
  }

  /**
   * Get next recommended node for user
   */
  async getNextRecommendedNode(userId: string, pathId: string): Promise<LearningNode | null> {
    try {
      const userProgress = await prisma.userProgress.findMany({
        where: {
          userId,
          node: {
            learningPathId: pathId
          }
        },
        include: {
          node: {
            include: {
              prerequisites: true,
              dependents: true
            }
          }
        }
      });

      const completedNodeIds = userProgress
        .filter(p => p.status === 'completed')
        .map(p => p.nodeId);

      // Find all nodes in the path
      const pathNodes = await prisma.learningNode.findMany({
        where: { learningPathId: pathId },
        include: {
          prerequisites: true,
          progress: {
            where: { userId }
          }
        },
        orderBy: { order: 'asc' }
      });

      // Find next available node
      for (const node of pathNodes) {
        // Skip if already completed or in progress
        const nodeProgress = node.progress[0];
        if (nodeProgress && ['completed', 'in_progress'].includes(nodeProgress.status)) {
          continue;
        }

        // Check if prerequisites are met
        const prerequisitesMet = node.prerequisites.every(prereq =>
          completedNodeIds.includes(prereq.prerequisiteNodeId)
        );

        if (prerequisitesMet) {
          return node;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting next recommended node:', error);
      throw new Error('Failed to get next recommended node');
    }
  }

  /**
   * Update user progress on a node
   */
  async updateProgress(userId: string, nodeId: string, progressData: {
    status: 'not_started' | 'in_progress' | 'completed' | 'failed';
    score?: number;
    timeSpent: number;
    attempts: number;
    feedback?: string;
  }): Promise<UserProgress> {
    try {
      const progress = await prisma.userProgress.upsert({
        where: {
          userId_nodeId: {
            userId,
            nodeId
          }
        },
        update: {
          status: progressData.status,
          score: progressData.score,
          timeSpent: progressData.timeSpent,
          attempts: progressData.attempts,
          feedback: progressData.feedback,
          completedAt: progressData.status === 'completed' ? new Date() : null,
          updatedAt: new Date()
        },
        create: {
          userId,
          nodeId,
          status: progressData.status,
          score: progressData.score,
          timeSpent: progressData.timeSpent,
          attempts: progressData.attempts,
          feedback: progressData.feedback,
          startedAt: new Date(),
          completedAt: progressData.status === 'completed' ? new Date() : null
        },
        include: {
          node: true,
          user: true
        }
      });

      // Update user skills if node completed successfully
      if (progressData.status === 'completed' && progressData.score && progressData.score >= 70) {
        await this.updateUserSkills(userId, nodeId);
      }

      // Check if path is completed
      await this.checkPathCompletion(userId, progress.node.learningPathId);

      logger.info(`Progress updated for user ${userId} on node ${nodeId}`);
      return progress;
    } catch (error) {
      logger.error('Error updating progress:', error);
      throw new Error('Failed to update progress');
    }
  }

  /**
   * Get adaptive recommendations based on performance
   */
  async getAdaptiveRecommendations(userId: string): Promise<{
    strengthenAreas: LearningNode[];
    nextChallenges: LearningNode[];
    reviewNodes: LearningNode[];
  }> {
    try {
      const userProgress = await this.getUserProgress(userId);
      const weakAreas = this.identifyWeakAreas(userProgress);
      const strengths = this.identifyStrengths(userProgress);

      // Get nodes to strengthen weak areas
      const strengthenAreas = await prisma.learningNode.findMany({
        where: {
          type: 'exercise',
          skills: {
            some: {
              name: { in: weakAreas }
            }
          }
        },
        take: 3
      });

      // Get challenging nodes based on strengths
      const nextChallenges = await prisma.learningNode.findMany({
        where: {
          difficulty: { gte: 7 },
          skills: {
            some: {
              name: { in: strengths }
            }
          }
        },
        take: 3
      });

      // Get nodes that need review (low scores)
      const lowScoreProgress = userProgress.filter(p => 
        p.score && p.score < 80 && p.status === 'completed'
      );
      
      const reviewNodes = await prisma.learningNode.findMany({
        where: {
          id: { in: lowScoreProgress.map(p => p.nodeId) }
        },
        take: 3
      });

      return {
        strengthenAreas,
        nextChallenges,
        reviewNodes
      };
    } catch (error) {
      logger.error('Error getting adaptive recommendations:', error);
      throw new Error('Failed to get adaptive recommendations');
    }
  }

  /**
   * Generate learning analytics
   */
  async getLearningAnalytics(userId: string, pathId?: string): Promise<{
    totalTimeSpent: number;
    completionRate: number;
    averageScore: number;
    skillsAcquired: string[];
    weakAreas: string[];
    strengths: string[];
    progressTrend: Array<{ date: string; progress: number }>;
  }> {
    try {
      const whereClause: any = { userId };
      if (pathId) {
        whereClause.node = { learningPathId: pathId };
      }

      const userProgress = await prisma.userProgress.findMany({
        where: whereClause,
        include: {
          node: {
            include: {
              skills: true
            }
          }
        },
        orderBy: { updatedAt: 'asc' }
      });

      const totalNodes = userProgress.length;
      const completedNodes = userProgress.filter(p => p.status === 'completed').length;
      const totalTimeSpent = userProgress.reduce((sum, p) => sum + p.timeSpent, 0);
      const scores = userProgress.filter(p => p.score !== null).map(p => p.score!);
      const averageScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

      // Calculate skills acquired
      const skillsAcquired = userProgress
        .filter(p => p.status === 'completed' && p.score && p.score >= 70)
        .flatMap(p => p.node.skills.map(s => s.name))
        .filter((skill, index, self) => self.indexOf(skill) === index);

      // Identify weak areas and strengths
      const weakAreas = this.identifyWeakAreas(userProgress);
      const strengths = this.identifyStrengths(userProgress);

      // Generate progress trend (last 30 days)
      const progressTrend = this.generateProgressTrend(userProgress);

      return {
        totalTimeSpent,
        completionRate: totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0,
        averageScore,
        skillsAcquired,
        weakAreas,
        strengths,
        progressTrend
      };
    } catch (error) {
      logger.error('Error getting learning analytics:', error);
      throw new Error('Failed to get learning analytics');
    }
  }

  // Private helper methods

  private async getUserProgress(userId: string): Promise<UserProgress[]> {
    return await prisma.userProgress.findMany({
      where: { userId },
      include: {
        node: {
          include: {
            skills: true
          }
        }
      }
    });
  }

  private async getUserSkills(userId: string): Promise<string[]> {
    const userSkills = await prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true }
    });
    return userSkills.map(us => us.skill.name);
  }

  private calculatePathRelevance(path: LearningPath, userSkills: string[], userProgress: UserProgress[]): number {
    let score = 0;

    // Skill match score
    const pathSkills = path.skills.map(s => s.name);
    const skillMatch = pathSkills.filter(skill => userSkills.includes(skill)).length;
    score += (skillMatch / pathSkills.length) * 40;

    // Difficulty appropriateness
    const userLevel = this.calculateUserLevel(userProgress);
    const difficultyScore = this.getDifficultyScore(path.difficulty, userLevel);
    score += difficultyScore * 30;

    // Completion rate bonus
    const completionRate = this.calculateCompletionRate(path, userProgress);
    if (completionRate > 0 && completionRate < 100) {
      score += 20; // Bonus for partially completed paths
    }

    // Freshness factor
    const daysSinceCreated = (Date.now() - new Date(path.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 30) {
      score += 10; // Bonus for newer content
    }

    return score;
  }

  private calculateCompletionRate(path: LearningPath, userProgress: UserProgress[]): number {
    const pathNodeIds = path.nodes.map(n => n.id);
    const completedInPath = userProgress.filter(p => 
      pathNodeIds.includes(p.nodeId) && p.status === 'completed'
    ).length;
    
    return pathNodeIds.length > 0 ? (completedInPath / pathNodeIds.length) * 100 : 0;
  }

  private calculateUserLevel(userProgress: UserProgress[]): number {
    const completedNodes = userProgress.filter(p => p.status === 'completed');
    const averageScore = completedNodes.length > 0 
      ? completedNodes.reduce((sum, p) => sum + (p.score || 0), 0) / completedNodes.length 
      : 0;
    
    if (averageScore >= 90) return 3; // Advanced
    if (averageScore >= 70) return 2; // Intermediate
    return 1; // Beginner
  }

   private getDifficultyScore(pathDifficulty: string, userLevel: number): number {
    const difficultyMap = { beginner: 1, intermediate: 2, advanced: 3 };
    const pathLevel = difficultyMap[pathDifficulty as keyof typeof difficultyMap];
    
    // Perfect match gets highest score
    if (pathLevel === userLevel) return 1.0;
    
    // One level difference gets moderate score
    if (Math.abs(pathLevel - userLevel) === 1) return 0.7;
    
    // Two level difference gets low score
    return 0.3;
  }

  private identifyWeakAreas(userProgress: UserProgress[]): string[] {
    const skillScores: { [skill: string]: number[] } = {};
    
    userProgress.forEach(progress => {
      if (progress.score && progress.node.skills) {
        progress.node.skills.forEach(skill => {
          if (!skillScores[skill.name]) {
            skillScores[skill.name] = [];
          }
          skillScores[skill.name].push(progress.score!);
        });
      }
    });

    return Object.entries(skillScores)
      .filter(([_, scores]) => {
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        return avgScore < 70;
      })
      .map(([skill, _]) => skill);
  }

  private identifyStrengths(userProgress: UserProgress[]): string[] {
    const skillScores: { [skill: string]: number[] } = {};
    
    userProgress.forEach(progress => {
      if (progress.score && progress.node.skills) {
        progress.node.skills.forEach(skill => {
          if (!skillScores[skill.name]) {
            skillScores[skill.name] = [];
          }
          skillScores[skill.name].push(progress.score!);
        });
      }
    });

    return Object.entries(skillScores)
      .filter(([_, scores]) => {
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        return avgScore >= 85;
      })
      .map(([skill, _]) => skill);
  }

  private generateProgressTrend(userProgress: UserProgress[]): Array<{ date: string; progress: number }> {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const dayProgress = userProgress.filter(p => {
        const progressDate = new Date(p.updatedAt).toISOString().split('T')[0];
        return progressDate === date && p.status === 'completed';
      });

      return {
        date,
        progress: dayProgress.length
      };
    });
  }

  private async updateUserSkills(userId: string, nodeId: string): Promise<void> {
    try {
      const node = await prisma.learningNode.findUnique({
        where: { id: nodeId },
        include: { skills: true }
      });

      if (!node) return;

      for (const skill of node.skills) {
        await prisma.userSkill.upsert({
          where: {
            userId_skillId: {
              userId,
              skillId: skill.id
            }
          },
          update: {
            proficiency: { increment: 10 },
            lastPracticed: new Date()
          },
          create: {
            userId,
            skillId: skill.id,
            proficiency: 10,
            lastPracticed: new Date()
          }
        });
      }
    } catch (error) {
      logger.error('Error updating user skills:', error);
    }
  }

  private async checkPathCompletion(userId: string, pathId: string): Promise<void> {
    try {
      const pathNodes = await prisma.learningNode.findMany({
        where: { learningPathId: pathId }
      });

      const userProgress = await prisma.userProgress.findMany({
        where: {
          userId,
          nodeId: { in: pathNodes.map(n => n.id) },
          status: 'completed'
        }
      });

      if (userProgress.length === pathNodes.length) {
        // Path completed - award certificate or badge
        await prisma.pathCompletion.create({
          data: {
            userId,
            learningPathId: pathId,
            completedAt: new Date(),
            certificateIssued: true
          }
        });

        logger.info(`Path completed by user ${userId}: ${pathId}`);
      }
    } catch (error) {
      logger.error('Error checking path completion:', error);
    }
  }

  /**
   * Get learning path statistics
   */
  async getPathStatistics(pathId: string): Promise<{
    totalEnrollments: number;
    completionRate: number;
    averageRating: number;
    averageCompletionTime: number;
    popularNodes: Array<{ nodeId: string; title: string; completions: number }>;
    difficultyDistribution: { [key: string]: number };
  }> {
    try {
      const path = await prisma.learningPath.findUnique({
        where: { id: pathId },
        include: {
          enrollments: true,
          nodes: {
            include: {
              progress: {
                where: { status: 'completed' }
              }
            }
          }
        }
      });

      if (!path) {
        throw new Error('Learning path not found');
      }

      const totalEnrollments = path.enrollments.length;
      const completions = await prisma.pathCompletion.count({
        where: { learningPathId: pathId }
      });

      const completionRate = totalEnrollments > 0 ? (completions / totalEnrollments) * 100 : 0;

      // Calculate average rating
      const ratings = await prisma.pathRating.findMany({
        where: { learningPathId: pathId }
      });
      const averageRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;

      // Calculate average completion time
      const completedPaths = await prisma.pathCompletion.findMany({
        where: { learningPathId: pathId },
        include: {
          user: {
            include: {
              progress: {
                where: {
                  node: { learningPathId: pathId }
                }
              }
            }
          }
        }
      });

      const averageCompletionTime = completedPaths.length > 0
        ? completedPaths.reduce((sum, completion) => {
            const userProgress = completion.user.progress;
            const totalTime = userProgress.reduce((time, p) => time + p.timeSpent, 0);
            return sum + totalTime;
          }, 0) / completedPaths.length
        : 0;

      // Get popular nodes
      const popularNodes = path.nodes
        .map(node => ({
          nodeId: node.id,
          title: node.title,
          completions: node.progress.length
        }))
        .sort((a, b) => b.completions - a.completions)
        .slice(0, 5);

      // Calculate difficulty distribution
      const difficultyDistribution = path.nodes.reduce((dist, node) => {
        const difficulty = node.difficulty <= 3 ? 'Easy' : 
                          node.difficulty <= 7 ? 'Medium' : 'Hard';
        dist[difficulty] = (dist[difficulty] || 0) + 1;
        return dist;
      }, {} as { [key: string]: number });

      return {
        totalEnrollments,
        completionRate,
        averageRating,
        averageCompletionTime,
        popularNodes,
        difficultyDistribution
      };
    } catch (error) {
      logger.error('Error getting path statistics:', error);
      throw new Error('Failed to get path statistics');
    }
  }

  /**
   * Clone a learning path
   */
  async cloneLearningPath(pathId: string, userId: string, modifications?: {
    title?: string;
    description?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  }): Promise<LearningPath> {
    try {
      const originalPath = await prisma.learningPath.findUnique({
        where: { id: pathId },
        include: {
          nodes: {
            include: {
              prerequisites: true
            },
            orderBy: { order: 'asc' }
          },
          skills: true
        }
      });

      if (!originalPath) {
        throw new Error('Original learning path not found');
      }

      // Create new path
      const newPath = await prisma.learningPath.create({
        data: {
          title: modifications?.title || `${originalPath.title} (Copy)`,
          description: modifications?.description || originalPath.description,
          difficulty: modifications?.difficulty || originalPath.difficulty,
          estimatedDuration: originalPath.estimatedDuration,
          createdBy: userId,
          skills: {
            connect: originalPath.skills.map(skill => ({ id: skill.id }))
          }
        }
      });

      // Clone nodes
      const nodeMapping: { [oldId: string]: string } = {};
      
      for (const originalNode of originalPath.nodes) {
        const newNode = await prisma.learningNode.create({
          data: {
            title: originalNode.title,
            description: originalNode.description,
            type: originalNode.type,
            content: originalNode.content,
            order: originalNode.order,
            estimatedTime: originalNode.estimatedTime,
            difficulty: originalNode.difficulty,
            learningPathId: newPath.id
          }
        });
        
        nodeMapping[originalNode.id] = newNode.id;
      }

      // Create prerequisites with new node IDs
      for (const originalNode of originalPath.nodes) {
        if (originalNode.prerequisites.length > 0) {
          await prisma.prerequisite.createMany({
            data: originalNode.prerequisites.map(prereq => ({
              nodeId: nodeMapping[originalNode.id],
              prerequisiteNodeId: nodeMapping[prereq.prerequisiteNodeId]
            }))
          });
        }
      }

      logger.info(`Learning path cloned: ${pathId} -> ${newPath.id}`);
      
      return await prisma.learningPath.findUnique({
        where: { id: newPath.id },
        include: {
          nodes: true,
          skills: true,
          enrollments: true
        }
      }) as LearningPath;
    } catch (error) {
      logger.error('Error cloning learning path:', error);
      throw new Error('Failed to clone learning path');
    }
  }

  /**
   * Get learning path recommendations based on job roles
   */
  async getJobRoleRecommendations(jobRole: string): Promise<LearningPath[]> {
    try {
      const jobRoleSkills = await prisma.jobRole.findUnique({
        where: { name: jobRole },
        include: { requiredSkills: true }
      });

      if (!jobRoleSkills) {
        throw new Error('Job role not found');
      }

      const skillIds = jobRoleSkills.requiredSkills.map(skill => skill.id);

      const recommendedPaths = await prisma.learningPath.findMany({
        where: {
          skills: {
            some: {
              id: { in: skillIds }
            }
          }
        },
        include: {
          nodes: true,
          skills: true,
          enrollments: true
        },
        orderBy: [
          { enrollments: { _count: 'desc' } },
          { createdAt: 'desc' }
        ],
        take: 10
      });

      return recommendedPaths;
    } catch (error) {
      logger.error('Error getting job role recommendations:', error);
      throw new Error('Failed to get job role recommendations');
    }
  }

  /**
   * Export learning path data
   */
  async exportLearningPath(pathId: string): Promise<any> {
    try {
      const path = await prisma.learningPath.findUnique({
        where: { id: pathId },
        include: {
          nodes: {
            include: {
              prerequisites: true,
              skills: true
            },
            orderBy: { order: 'asc' }
          },
          skills: true
        }
      });

      if (!path) {
        throw new Error('Learning path not found');
      }

      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        path: {
          title: path.title,
          description: path.description,
          difficulty: path.difficulty,
          estimatedDuration: path.estimatedDuration,
          skills: path.skills.map(skill => ({
            name: skill.name,
            category: skill.category
          })),
          nodes: path.nodes.map(node => ({
            title: node.title,
            description: node.description,
            type: node.type,
            content: node.content,
            order: node.order,
            estimatedTime: node.estimatedTime,
            difficulty: node.difficulty,
            prerequisites: node.prerequisites.map(p => p.prerequisiteNodeId),
            skills: node.skills.map(skill => skill.name)
          }))
        }
      };
    } catch (error) {
      logger.error('Error exporting learning path:', error);
      throw new Error('Failed to export learning path');
    }
  }

  /**
   * Import learning path data
   */
  async importLearningPath(pathData: any, userId: string): Promise<LearningPath> {
    try {
      // Validate import data structure
      if (!pathData.path || !pathData.path.nodes) {
        throw new Error('Invalid learning path data structure');
      }

      const { path } = pathData;

      // Create or find skills
      const skillIds: string[] = [];
      for (const skillData of path.skills) {
        const skill = await prisma.skill.upsert({
          where: { name: skillData.name },
          update: {},
          create: {
            name: skillData.name,
            category: skillData.category || 'General'
          }
        });
        skillIds.push(skill.id);
      }

      // Create learning path
      const newPath = await prisma.learningPath.create({
        data: {
          title: path.title,
          description: path.description,
          difficulty: path.difficulty,
          estimatedDuration: path.estimatedDuration,
          createdBy: userId,
          skills: {
            connect: skillIds.map(id => ({ id }))
          }
        }
      });

      // Create nodes and build mapping
      const nodeMapping: { [oldIndex: number]: string } = {};
      
      for (let i = 0; i < path.nodes.length; i++) {
        const nodeData = path.nodes[i];
        
        const newNode = await prisma.learningNode.create({
          data: {
            title: nodeData.title,
            description: nodeData.description,
            type: nodeData.type,
            content: nodeData.content,
            order: nodeData.order,
                        estimatedTime: nodeData.estimatedTime,
            difficulty: nodeData.difficulty,
            learningPathId: newPath.id
          }
        });
        
        nodeMapping[i] = newNode.id;
      }

      // Create prerequisites using the mapping
      for (let i = 0; i < path.nodes.length; i++) {
        const nodeData = path.nodes[i];
        if (nodeData.prerequisites && nodeData.prerequisites.length > 0) {
          const prerequisites = nodeData.prerequisites.map((prereqIndex: number) => ({
            nodeId: nodeMapping[i],
            prerequisiteNodeId: nodeMapping[prereqIndex]
          }));

          await prisma.prerequisite.createMany({
            data: prerequisites
          });
        }
      }

      logger.info(`Learning path imported: ${newPath.id}`);
      
      return await prisma.learningPath.findUnique({
        where: { id: newPath.id },
        include: {
          nodes: true,
          skills: true,
          enrollments: true
        }
      }) as LearningPath;
    } catch (error) {
      logger.error('Error importing learning path:', error);
      throw new Error('Failed to import learning path');
    }
  }

  /**
   * Get learning path dependencies
   */
  async getPathDependencies(pathId: string): Promise<{
    prerequisites: LearningPath[];
    dependents: LearningPath[];
    sharedSkills: Array<{ skill: string; paths: LearningPath[] }>;
  }> {
    try {
      const path = await prisma.learningPath.findUnique({
        where: { id: pathId },
        include: { skills: true }
      });

      if (!path) {
        throw new Error('Learning path not found');
      }

      const skillIds = path.skills.map(s => s.id);

      // Find paths with overlapping skills
      const relatedPaths = await prisma.learningPath.findMany({
        where: {
          id: { not: pathId },
          skills: {
            some: {
              id: { in: skillIds }
            }
          }
        },
        include: {
          skills: true,
          nodes: true
        }
      });

      // Categorize as prerequisites (easier) or dependents (harder)
      const prerequisites = relatedPaths.filter(p => 
        this.getDifficultyLevel(p.difficulty) < this.getDifficultyLevel(path.difficulty)
      );

      const dependents = relatedPaths.filter(p => 
        this.getDifficultyLevel(p.difficulty) > this.getDifficultyLevel(path.difficulty)
      );

      // Group by shared skills
      const sharedSkills = path.skills.map(skill => ({
        skill: skill.name,
        paths: relatedPaths.filter(p => 
          p.skills.some(s => s.id === skill.id)
        )
      })).filter(item => item.paths.length > 0);

      return {
        prerequisites,
        dependents,
        sharedSkills
      };
    } catch (error) {
      logger.error('Error getting path dependencies:', error);
      throw new Error('Failed to get path dependencies');
    }
  }

  private getDifficultyLevel(difficulty: string): number {
    const levels = { beginner: 1, intermediate: 2, advanced: 3 };
    return levels[difficulty as keyof typeof levels] || 1;
  }

  /**
   * Generate learning path certificate
   */
  async generateCertificate(userId: string, pathId: string): Promise<{
    certificateId: string;
    certificateUrl: string;
    issuedAt: Date;
    validUntil: Date;
  }> {
    try {
      // Verify path completion
      const completion = await prisma.pathCompletion.findUnique({
        where: {
          userId_learningPathId: {
            userId,
            learningPathId: pathId
          }
        },
        include: {
          learningPath: true,
          user: true
        }
      });

      if (!completion) {
        throw new Error('Learning path not completed');
      }

      // Generate certificate
      const certificate = await prisma.certificate.create({
        data: {
          userId,
          learningPathId: pathId,
          certificateNumber: this.generateCertificateNumber(),
          issuedAt: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
          metadata: {
            pathTitle: completion.learningPath.title,
            userName: completion.user.name,
            completionDate: completion.completedAt,
            skills: completion.learningPath.skills?.map(s => s.name) || []
          }
        }
      });

      // Generate certificate URL (this would integrate with a certificate generation service)
      const certificateUrl = await this.generateCertificateDocument(certificate);

      logger.info(`Certificate generated for user ${userId} on path ${pathId}`);

      return {
        certificateId: certificate.id,
        certificateUrl,
        issuedAt: certificate.issuedAt,
        validUntil: certificate.validUntil
      };
    } catch (error) {
      logger.error('Error generating certificate:', error);
      throw new Error('Failed to generate certificate');
    }
  }

  private generateCertificateNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `CERT-${timestamp}-${random}`.toUpperCase();
  }

  private async generateCertificateDocument(certificate: any): Promise<string> {
    // This would integrate with a PDF generation service or similar
    // For now, return a placeholder URL
    return `https://certificates.virtuallab.com/${certificate.id}.pdf`;
  }

  /**
   * Get learning path leaderboard
   */
  async getPathLeaderboard(pathId: string, limit: number = 10): Promise<Array<{
    userId: string;
    userName: string;
    completionTime: number;
    averageScore: number;
    completedAt: Date;
    rank: number;
  }>> {
    try {
      const completions = await prisma.pathCompletion.findMany({
        where: { learningPathId: pathId },
        include: {
          user: true,
          learningPath: {
            include: {
              nodes: {
                include: {
                  progress: {
                    where: { 
                      userId: { in: [] } // Will be filled dynamically
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { completedAt: 'asc' },
        take: limit
      });

      const leaderboard = await Promise.all(
        completions.map(async (completion, index) => {
          // Get user's progress for this path
          const userProgress = await prisma.userProgress.findMany({
            where: {
              userId: completion.userId,
              node: {
                learningPathId: pathId
              }
            }
          });

          const totalTime = userProgress.reduce((sum, p) => sum + p.timeSpent, 0);
          const scores = userProgress.filter(p => p.score !== null).map(p => p.score!);
          const averageScore = scores.length > 0 
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
            : 0;

          return {
            userId: completion.userId,
            userName: completion.user.name,
            completionTime: totalTime,
            averageScore,
            completedAt: completion.completedAt,
            rank: index + 1
          };
        })
      );

      // Sort by average score (descending) then by completion time (ascending)
      return leaderboard.sort((a, b) => {
        if (b.averageScore !== a.averageScore) {
          return b.averageScore - a.averageScore;
        }
        return a.completionTime - b.completionTime;
      }).map((entry, index) => ({ ...entry, rank: index + 1 }));
    } catch (error) {
      logger.error('Error getting path leaderboard:', error);
      throw new Error('Failed to get path leaderboard');
    }
  }

  /**
   * Schedule learning reminders
   */
  async scheduleReminders(userId: string, pathId: string, preferences: {
    frequency: 'daily' | 'weekly' | 'biweekly';
    time: string; // HH:MM format
    timezone: string;
    enabled: boolean;
  }): Promise<void> {
    try {
      await prisma.learningReminder.upsert({
        where: {
          userId_learningPathId: {
            userId,
            learningPathId: pathId
          }
        },
        update: {
          frequency: preferences.frequency,
          time: preferences.time,
          timezone: preferences.timezone,
          enabled: preferences.enabled,
          updatedAt: new Date()
        },
        create: {
          userId,
          learningPathId: pathId,
          frequency: preferences.frequency,
          time: preferences.time,
          timezone: preferences.timezone,
          enabled: preferences.enabled
        }
      });

      // Here you would integrate with a job scheduler (like Bull Queue, Agenda, etc.)
      // to actually schedule the reminder notifications

      logger.info(`Learning reminders scheduled for user ${userId} on path ${pathId}`);
    } catch (error) {
      logger.error('Error scheduling reminders:', error);
      throw new Error('Failed to schedule learning reminders');
    }
  }

  /**
   * Get learning streak information
   */
  async getLearningStreak(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
    streakHistory: Array<{ date: string; activity: boolean }>;
  }> {
    try {
      // Get user's learning activities for the last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const activities = await prisma.userProgress.findMany({
        where: {
          userId,
          updatedAt: { gte: ninetyDaysAgo }
        },
        orderBy: { updatedAt: 'desc' }
      });

      // Group activities by date
      const activityByDate: { [date: string]: boolean } = {};
      activities.forEach(activity => {
        const date = activity.updatedAt.toISOString().split('T')[0];
        activityByDate[date] = true;
      });

      // Calculate current streak
      let currentStreak = 0;
      const today = new Date();
      for (let i = 0; i < 90; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateString = checkDate.toISOString().split('T')[0];
        
        if (activityByDate[dateString]) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let tempStreak = 0;
      
      for (let i = 89; i >= 0; i--) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateString = checkDate.toISOString().split('T')[0];
        
        if (activityByDate[dateString]) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      // Get last activity date
      const lastActivityDate = activities.length > 0 ? activities[0].updatedAt : null;

      // Generate streak history for last 30 days
      const streakHistory = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (29 - i));
        const dateString = date.toISOString().split('T')[0];
        
        return {
          date: dateString,
          activity: !!activityByDate[dateString]
        };
      });

      return {
        currentStreak,
        longestStreak,
        lastActivityDate,
        streakHistory
      };
    } catch (error) {
      logger.error('Error getting learning streak:', error);
      throw new Error('Failed to get learning streak');
    }
  }

  /**
   * Cleanup and maintenance methods
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      await prisma.learningSession.deleteMany({
        where: {
          updatedAt: { lt: oneDayAgo },
          status: 'abandoned'
        }
      });

      logger.info('Expired learning sessions cleaned up');
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
    }
  }

  async generateDailyReports(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
      const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

      // Generate daily activity report
      const dailyStats = await prisma.userProgress.groupBy({
        by: ['status'],
        where: {
          updatedAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        _count: {
          id: true
        }
      });

      // Store daily report
      await prisma.dailyReport.create({
        data: {
          date: startOfDay,
          stats: dailyStats,
          generatedAt: new Date()
        }
      });

      logger.info(`Daily report generated for ${startOfDay.toISOString().split('T')[0]}`);
    } catch (error) {
      logger.error('Error generating daily reports:', error);
    }
  }
}

export const learningPathService = new LearningPathService();

