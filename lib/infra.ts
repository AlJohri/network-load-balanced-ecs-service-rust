import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { execSync } from 'child_process';

export class InfraStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly cluster: ecs.Cluster;
  readonly nlb: elbv2.NetworkLoadBalancer;
  readonly nlbSG: ec2.SecurityGroup;
  readonly capacityProvider: ecs.AsgCapacityProvider;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'VPC');
    this.cluster = new ecs.Cluster(this, 'Cluster', { vpc: this.vpc });

    // NOTE: for demo purposes, we are ensuring the architecture we deploy to
    // matches the archtecture of the machine we are deploying from. this is
    // to ensure a smooth experience on m1 macs where we will deploy an arm
    // based docker image and then deploy to an arm (graviton) based machine
    let machineImage;
    let instanceType;
    const architecuture = execSync('uname -m').toString().trim();
    if (architecuture === "arm64") {
      machineImage = ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.ARM);
      instanceType = new ec2.InstanceType('c6g.large');
    } else {
      machineImage = ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.STANDARD);
      instanceType = new ec2.InstanceType('c6i.large');
    }

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc: this.vpc,
      instanceType,
      machineImage,
    });
    this.capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup,
    });
    this.cluster.addAsgCapacityProvider(this.capacityProvider);

    this.nlbSG = new ec2.SecurityGroup(this, 'NLBSecurityGroup', { vpc: this.vpc });

    // NOTE: for demo purposes, we using curl to check the current public ip address
    // of the machine deploying the stacks and only allow ingress from that IP
    const currentIP = execSync('curl -s checkip.amazonaws.com').toString().trim();

    this.nlbSG.addIngressRule(
      ec2.Peer.ipv4(`${currentIP}/32`),
      ec2.Port.tcp(80),
    )

    this.nlb = new elbv2.NetworkLoadBalancer(this, 'NLB', {
      vpc: this.vpc,
      internetFacing: true,
    });
    const child = this.nlb.node.defaultChild as elbv2.CfnLoadBalancer;
    child.addOverride("Properties.SecurityGroups", [this.nlbSG.securityGroupId]);

  }
}
