#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra';
import { ServiceStack } from '../lib/service';

const app = new cdk.App();
const infra = new InfraStack(app, 'network-load-balanced-ecs-service-rust-infra-stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
new ServiceStack(app, 'network-load-balanced-ecs-service-rust-service-stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  vpc: infra.vpc,
  cluster: infra.cluster,
  nlb: infra.nlb,
  nlbSG: infra.nlbSG,
  capacityProvider: infra.capacityProvider
})
